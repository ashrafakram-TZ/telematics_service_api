import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { zoneDates } from '../../common';
import { appConfig, AppConfig } from '../../config/configuration';
import { tripsConfig, TripsConfig } from '../../config/trips.config';
import { TripEvent } from './entities/trip-event.entity';
import { TripWebhookBody } from './trip-view';
import {
  DELIVERY_TIMEOUT_MS,
  EVENT_HEADER,
  LatestWinsThrottle,
  POSITION_THROTTLE_MS,
  RETRY_DELAYS_MS,
  SIGNATURE_HEADER,
  signBody,
} from './trip-webhook';

export interface DeliveryResult {
  ok: boolean;
  error?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class TripWebhookService implements OnApplicationBootstrap {
  private readonly logger = new Logger('TripWebhook');
  private readonly queues = new Map<number, Promise<void>>();
  private readonly positions = new LatestWinsThrottle<TripWebhookBody>(POSITION_THROTTLE_MS, (body) => {
    void this.post(body).then((result) => {
      if (!result.ok) this.logger.debug(`trip.position for trip ${body.trip.id}: ${result.error}`);
    });
  });
  protected wait: (ms: number) => Promise<unknown> = sleep;

  constructor(
    @Inject(tripsConfig.KEY) private readonly config: TripsConfig,
    @Inject(appConfig.KEY) private readonly app: AppConfig,
    @InjectRepository(TripEvent) private readonly events: Repository<TripEvent>,
  ) {}

  get enabled(): boolean {
    return !!this.config.webhookUrl;
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) this.logger.warn('TRIP_WEBHOOK_URL is empty: trip webhooks are off');
    else this.logger.log(`Trip webhooks go to ${this.config.webhookUrl}`);
  }

  position(body: TripWebhookBody): void {
    if (this.enabled) this.positions.push(body.trip.id, body);
  }

  forgetTrip(tripId: number): void {
    this.positions.forget(tripId);
  }

  enqueue(body: TripWebhookBody): void {
    if (!this.enabled) return;
    const tripId = body.trip.id;
    const previous = this.queues.get(tripId) ?? Promise.resolve();
    const next = previous.then(() => this.deliver(body)).catch((error: Error) => this.logger.error(error.message));
    this.queues.set(tripId, next);
    void next.then(() => {
      if (this.queues.get(tripId) === next) this.queues.delete(tripId);
    });
  }

  idle(): Promise<void> {
    return Promise.all([...this.queues.values()]).then(() => undefined);
  }

  private async deliver(body: TripWebhookBody): Promise<void> {
    let attempt = 0;
    for (;;) {
      const result = await this.post(body);
      attempt += 1;
      await this.record(body.id, attempt, result);
      if (result.ok) return;
      this.logger.warn(`${body.type} #${body.id} for trip ${body.trip.id} attempt ${attempt}: ${result.error}`);
      const delay = RETRY_DELAYS_MS[attempt - 1];
      if (delay === undefined) {
        this.logger.error(`${body.type} #${body.id} for trip ${body.trip.id} failed after ${attempt} attempts`);
        return;
      }
      await this.wait(delay);
    }
  }

  private async record(id: number, attempts: number, result: DeliveryResult): Promise<void> {
    if (!id) return;
    const final = result.ok || attempts > RETRY_DELAYS_MS.length;
    await this.events.update(id, {
      delivery_attempts: attempts,
      delivery_status: result.ok ? 'delivered' : final ? 'failed' : 'pending',
      delivered_at: result.ok ? new Date() : null,
      last_error: result.ok ? null : (result.error ?? 'unknown error').slice(0, 300),
    });
  }

  protected async post(body: TripWebhookBody): Promise<DeliveryResult> {
    const raw = JSON.stringify(zoneDates(body, this.app.timeZone));
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [EVENT_HEADER]: body.type,
          [SIGNATURE_HEADER]: signBody(raw, this.config.webhookSecret),
        },
        body: raw,
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });
      return response.ok ? { ok: true } : { ok: false, error: `HTTP ${response.status}` };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }
}
