import { createHmac } from 'crypto';
import { createServer, IncomingHttpHeaders, Server } from 'http';
import { AddressInfo } from 'net';
import { Repository } from 'typeorm';
import { AppConfig } from '../../config/configuration';
import { TripsConfig } from '../../config/trips.config';
import { TripEvent } from './entities/trip-event.entity';
import { TripWebhookBody } from './trip-view';
import { LatestWinsThrottle, RETRY_DELAYS_MS, signBody } from './trip-webhook';
import { DeliveryResult, TripWebhookService } from './trip-webhook.service';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';

const body = (id: number, type: TripWebhookBody['type'] = 'stop.arrived'): TripWebhookBody => ({
  id,
  type,
  at: new Date('2026-11-09T01:42:30.000Z'),
  trip: { id: 7, ref: 'TZMS-41', device_id: 1, kind: 'pickup' },
  stop: { ref: '12', name: 'Mogappair East bus stand', sequence: 1 },
  eta_seconds: 0,
  position: null,
  end_reason: null,
});

function service(url: string) {
  const update = jest.fn().mockResolvedValue(undefined);
  const subject = new TripWebhookService(
    { webhookUrl: url, webhookSecret: SECRET } as TripsConfig,
    { timeZone: 'Asia/Kolkata' } as AppConfig,
    { update } as unknown as Repository<TripEvent>,
  );
  return { subject, update };
}

type Internals = { post: (b: TripWebhookBody) => Promise<DeliveryResult>; wait: (ms: number) => Promise<unknown> };

describe('webhook signature', () => {
  it('is sha256= plus the hex HMAC of the raw body', () => {
    const raw = '{"id":1,"type":"trip.started"}';
    const expected = createHmac('sha256', SECRET).update(raw).digest('hex');
    expect(signBody(raw, SECRET)).toBe(`sha256=${expected}`);
    expect(signBody(raw, SECRET)).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(signBody(`${raw} `, SECRET)).not.toBe(signBody(raw, SECRET));
  });

  describe('over HTTP', () => {
    let server: Server;
    const received: { headers: IncomingHttpHeaders; raw: string }[] = [];

    beforeAll(async () => {
      server = createServer((req, res) => {
        let raw = '';
        req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
        req.on('end', () => {
          received.push({ headers: req.headers, raw });
          res.writeHead(204).end();
        });
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    });

    afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

    it('sends headers the receiver can verify and dates in the app time zone', async () => {
      const { port } = server.address() as AddressInfo;
      const { subject, update } = service(`http://127.0.0.1:${port}/events`);
      subject.enqueue(body(1501, 'stop.approaching'));
      await subject.idle();

      expect(received).toHaveLength(1);
      const [{ headers, raw }] = received;
      expect(headers['content-type']).toBe('application/json');
      expect(headers['x-telematics-event']).toBe('stop.approaching');
      expect(headers['x-telematics-signature']).toBe(
        `sha256=${createHmac('sha256', SECRET).update(raw).digest('hex')}`,
      );
      expect(JSON.parse(raw)).toMatchObject({
        id: 1501,
        type: 'stop.approaching',
        at: '2026-11-09T07:12:30.000+05:30',
      });
      expect(update).toHaveBeenCalledWith(1501, expect.objectContaining({ delivery_status: 'delivered' }));
    });
  });
});

describe('webhook delivery', () => {
  it('retries a failed event with backoff and keeps the order per trip', async () => {
    const { subject, update } = service('http://127.0.0.1:1/events');
    const internals = subject as unknown as Internals;
    const sent: number[] = [];
    const waits: number[] = [];
    let failures = 2;
    internals.wait = (ms) => {
      waits.push(ms);
      return Promise.resolve();
    };
    internals.post = async (item) => {
      sent.push(item.id);
      if (item.id === 1 && failures > 0) {
        failures -= 1;
        return { ok: false, error: 'HTTP 503' };
      }
      return { ok: true };
    };

    subject.enqueue(body(1));
    subject.enqueue(body(2));
    await subject.idle();

    expect(sent).toEqual([1, 1, 1, 2]);
    expect(waits).toEqual([RETRY_DELAYS_MS[0], RETRY_DELAYS_MS[1]]);
    expect(update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ delivery_status: 'delivered', delivery_attempts: 3 }),
    );
  });

  it('gives up after three retries and marks the event failed', async () => {
    const { subject, update } = service('http://127.0.0.1:1/events');
    const internals = subject as unknown as Internals;
    internals.wait = () => Promise.resolve();
    internals.post = async () => ({ ok: false, error: 'timeout' });
    subject.enqueue(body(9));
    await subject.idle();
    expect(update).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
    expect(update).toHaveBeenLastCalledWith(
      9,
      expect.objectContaining({ delivery_status: 'failed', delivery_attempts: 4 }),
    );
  });

  it('does nothing when the webhook URL is empty', async () => {
    const { subject, update } = service('');
    const internals = subject as unknown as Internals;
    internals.post = jest.fn();
    subject.enqueue(body(3));
    subject.position(body(0, 'trip.position'));
    await subject.idle();
    expect(internals.post).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('position throttle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('sends at most one position per 2 s per trip and the latest wins', () => {
    const sent: string[] = [];
    const throttle = new LatestWinsThrottle<string>(2000, (value) => sent.push(value));

    throttle.push(7, 'a');
    expect(sent).toEqual(['a']);
    jest.advanceTimersByTime(500);
    throttle.push(7, 'b');
    jest.advanceTimersByTime(500);
    throttle.push(7, 'c');
    throttle.push(8, 'other-trip');
    expect(sent).toEqual(['a', 'other-trip']);

    jest.advanceTimersByTime(999);
    expect(sent).toEqual(['a', 'other-trip']);
    jest.advanceTimersByTime(1);
    expect(sent).toEqual(['a', 'other-trip', 'c']);

    jest.advanceTimersByTime(2000);
    throttle.push(7, 'd');
    expect(sent).toEqual(['a', 'other-trip', 'c', 'd']);
  });

  it('drops a pending position when the trip is forgotten', () => {
    const sent: string[] = [];
    const throttle = new LatestWinsThrottle<string>(2000, (value) => sent.push(value));
    throttle.push(7, 'a');
    throttle.push(7, 'b');
    throttle.forget(7);
    jest.advanceTimersByTime(5000);
    expect(sent).toEqual(['a']);
  });
});
