import {
  advanceTrip,
  closeStops,
  EnginePoint,
  EngineStop,
  EngineTrip,
  etaSpeedKmph,
  recentSpeeds,
  StopEvent,
  TripKind,
} from './trip-engine';

const LAT = 13.08;
const START = new Date('2026-11-09T01:30:00.000Z');

function stop(id: number, lng: number, radius = 100): EngineStop {
  return {
    id,
    sequence: id,
    lat: LAT,
    lng,
    radius_m: radius,
    status: 'pending',
    eta_seconds: null,
    distance_m: null,
    approached_at: null,
    arrived_at: null,
    departed_at: null,
  };
}

function trip(kind: TripKind = 'pickup', overrides: Partial<EngineTrip> = {}): EngineTrip {
  return {
    kind,
    started_at: START,
    approach_minutes: 5,
    approach_metres: 800,
    destination: { lat: LAT, lng: kind === 'pickup' ? 80.21 : 80.17, radius_m: 200 },
    stops: [stop(1, 80.19), stop(2, 80.2)],
    ...overrides,
  };
}

const at = (seconds: number, lng: number): EnginePoint => ({
  lat: LAT,
  lng,
  recorded_at: new Date(START.getTime() + seconds * 1000),
});

function drive(subject: EngineTrip, fromLng: number, toLng: number, stepLng = 0.0004, speed = 30) {
  const log: (StopEvent & { lng: number })[] = [];
  let ended: string | null = null;
  let second = 0;
  const direction = Math.sign(toLng - fromLng);
  for (let lng = fromLng; direction * (toLng - lng) >= -1e-9 && !ended; lng += direction * stepLng) {
    second += 5;
    const result = advanceTrip(subject, at(second, lng), speed);
    log.push(...result.events.map((event) => ({ ...event, lng })));
    ended = result.end_reason;
  }
  return { log, ended };
}

const order = (log: StopEvent[], stopId: number) => log.filter((e) => e.stop_id === stopId).map((e) => e.type);

describe('ETA speed', () => {
  it('averages recent speeds and clamps to 12-40 km/h', () => {
    expect(etaSpeedKmph([])).toBe(12);
    expect(etaSpeedKmph([0, 0, 5])).toBe(12);
    expect(etaSpeedKmph([20, 30])).toBe(25);
    expect(etaSpeedKmph([55, 70])).toBe(40);
  });

  it('keeps only the last two minutes of samples', () => {
    const now = START.getTime();
    const samples = [
      { at: now - 150_000, speed: 60 },
      { at: now - 60_000, speed: 20 },
      { at: now, speed: 30 },
    ];
    expect(recentSpeeds(samples, now).map((s) => s.speed)).toEqual([20, 30]);
  });
});

describe('trip engine ETA', () => {
  it('sums the path through the remaining stops to the destination', () => {
    const subject = trip();
    const result = advanceTrip(subject, at(5, 80.18), 36);
    const [first, second] = subject.stops;
    expect(first.distance_m).toBeGreaterThan(1080);
    expect(first.distance_m).toBeLessThan(1090);
    expect(first.eta_seconds).toBe(Math.round(first.distance_m! / 10));
    expect(second.distance_m).toBeGreaterThan(2160);
    expect(second.eta_seconds).toBeGreaterThan(first.eta_seconds!);
    expect(result.destination_eta_seconds).toBeGreaterThan(320);
    expect(result.destination_eta_seconds).toBeLessThan(330);
    expect(result.next_stop_id).toBe(1);
  });

  it('gives no destination ETA for a drop trip', () => {
    expect(advanceTrip(trip('drop'), at(5, 80.18), 30).destination_eta_seconds).toBeNull();
  });
});

describe('stop events', () => {
  it('fires approaching before arrived, then departed, for every stop', () => {
    const subject = trip();
    const { log } = drive(subject, 80.17, 80.212);
    for (const id of [1, 2]) {
      expect(order(log, id)).toEqual(['stop.approaching', 'stop.arrived', 'stop.departed']);
      const approach = log.find((e) => e.stop_id === id && e.type === 'stop.approaching')!;
      const arrival = log.find((e) => e.stop_id === id && e.type === 'stop.arrived')!;
      expect(approach.lng).toBeLessThan(arrival.lng);
      expect(approach.eta_seconds).toBeGreaterThan(0);
    }
    const stop1 = subject.stops[0];
    expect(stop1.approached_at!.getTime()).toBeLessThan(stop1.arrived_at!.getTime());
    expect(stop1.arrived_at!.getTime()).toBeLessThan(stop1.departed_at!.getTime());
  });

  it('fires approaching once the stop is within approach_metres even when the ETA is long', () => {
    const subject = trip('pickup', { approach_minutes: 1 });
    expect(advanceTrip(subject, at(5, 80.19 - 0.0085), 12).events).toEqual([]);
    const near = advanceTrip(subject, at(10, 80.19 - 0.0068), 12);
    expect(near.events).toEqual([{ type: 'stop.approaching', stop_id: 1, eta_seconds: expect.any(Number) }]);
    expect(near.events[0].eta_seconds).toBeGreaterThan(60);
    expect(advanceTrip(subject, at(15, 80.19 - 0.006), 12).events).toEqual([]);
  });

  it('fires approaching then arrived together when the first point is already inside the stop', () => {
    const subject = trip();
    const result = advanceTrip(subject, at(5, 80.19), 20);
    expect(result.events.map((e) => [e.type, e.stop_id])).toEqual([
      ['stop.approaching', 1],
      ['stop.arrived', 1],
      ['stop.approaching', 2],
    ]);
    expect(subject.stops[0].eta_seconds).toBe(0);
  });

  it('skips earlier pending stops when the bus arrives at a later one', () => {
    const subject = trip('pickup', { stops: [stop(1, 80.19), stop(2, 80.2), stop(3, 80.205)] });
    const result = advanceTrip(subject, at(5, 80.2), 25);
    expect(subject.stops.map((s) => s.status)).toEqual(['skipped', 'arrived', 'approaching']);
    expect(result.events.map((e) => [e.type, e.stop_id])).toEqual([
      ['stop.approaching', 2],
      ['stop.arrived', 2],
      ['stop.approaching', 3],
    ]);
    expect(subject.stops[0].eta_seconds).toBeNull();
    expect(result.next_stop_id).toBe(2);
  });

  it('departs a stop when the next point is already at a later stop', () => {
    const subject = trip();
    advanceTrip(subject, at(5, 80.19), 25);
    const result = advanceTrip(subject, at(10, 80.2), 25);
    expect(result.events.map((e) => [e.type, e.stop_id])).toEqual([
      ['stop.departed', 1],
      ['stop.arrived', 2],
    ]);
  });

  it('stays arrived while the bus dwells inside the radius', () => {
    const subject = trip();
    advanceTrip(subject, at(5, 80.19), 25);
    expect(advanceTrip(subject, at(10, 80.1902), 0).events).toEqual([]);
    expect(subject.stops[0].status).toBe('arrived');
  });
});

describe('auto end', () => {
  it('ends a pickup trip inside the school once every stop is done', () => {
    const subject = trip();
    const { log, ended } = drive(subject, 80.17, 80.212);
    expect(ended).toBe('arrived_school');
    expect(subject.stops.every((s) => s.status === 'departed')).toBe(true);
    expect(log.filter((e) => e.type === 'stop.departed')).toHaveLength(2);
  });

  it('does not end a pickup trip at the school in its first 3 minutes while stops are pending', () => {
    const subject = trip();
    expect(advanceTrip(subject, at(60, 80.21), 0).end_reason).toBeNull();
  });

  it('ends a pickup trip at the school after 3 minutes and skips the stops not visited', () => {
    const subject = trip();
    const result = advanceTrip(subject, at(200, 80.21), 0);
    expect(result.end_reason).toBe('arrived_school');
    expect(subject.stops.map((s) => s.status)).toEqual(['skipped', 'skipped']);
    expect(result.next_stop_id).toBeNull();
    expect(result.destination_eta_seconds).toBe(0);
  });

  it('ends a drop trip with route_complete after the last stop is departed', () => {
    const subject = trip('drop');
    const { log, ended } = drive(subject, 80.17, 80.205);
    expect(ended).toBe('route_complete');
    expect(order(log, 2)).toEqual(['stop.approaching', 'stop.arrived', 'stop.departed']);
  });

  it('does not end a drop trip while the bus waits at the last stop', () => {
    const subject = trip('drop');
    drive(subject, 80.17, 80.2);
    expect(subject.stops[1].status).toBe('arrived');
    expect(advanceTrip(subject, at(999, 80.2), 0).end_reason).toBeNull();
  });

  it('closes stops when a trip is ended by hand', () => {
    const subject = trip();
    advanceTrip(subject, at(5, 80.19), 20);
    expect(closeStops(subject, at(10, 80.19).recorded_at)).toEqual([
      { type: 'stop.departed', stop_id: 1, eta_seconds: null },
    ]);
    expect(subject.stops.map((s) => s.status)).toEqual(['departed', 'skipped']);
  });
});
