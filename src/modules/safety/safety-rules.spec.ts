import { distanceToPathMeters } from '../../common/utils/geo';
import { downsample, trackStats } from '../trips/trip-playback';
import {
  brakingRate,
  deviationApplies,
  evaluateSafety,
  newSafetyState,
  SafetyPoint,
  SafetySettings,
  SafetyTrip,
  tripPath,
} from './safety-rules';
import { alertBody } from './safety-view';

const settings: SafetySettings = {
  speed_limit_kmh: 50,
  overspeed_seconds: 10,
  harsh_brake_kmh_per_s: 12,
  idle_minutes: 5,
  deviation_m: 300,
  deviation_seconds: 30,
  cooldown_seconds: 300,
};

const T0 = Date.parse('2026-11-09T01:30:00.000Z');
const point = (seconds: number, speed: number | null, extra: Partial<SafetyPoint> = {}): SafetyPoint => ({
  at: T0 + seconds * 1000,
  lat: 13.08,
  lng: 80.2,
  speed,
  ignition: true,
  event: null,
  ...extra,
});

const run = (points: SafetyPoint[], trip: SafetyTrip | null = null, state = newSafetyState(), config = settings) =>
  points.flatMap((item) => evaluateSafety(state, item, config, trip));

const straightTrip: SafetyTrip = {
  path: [
    { lat: 13.08, lng: 80.2 },
    { lat: 13.08, lng: 80.25 },
  ],
  check_deviation: true,
};

describe('overspeed', () => {
  it('needs the speed above the limit for overspeed_seconds', () => {
    expect(run([point(0, 62), point(5, 64), point(8, 63)])).toEqual([]);
    const found = run([point(0, 62), point(5, 66), point(10, 64)]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'overspeed', severity: 'medium', value: 66, limit: 50 });
    expect(found[0].message).toBe('Overspeed: 66 km/h for 10 s (limit 50 km/h)');
  });

  it('raises once per episode and resets when the bus slows down', () => {
    const state = newSafetyState();
    expect(run([point(0, 60), point(10, 60), point(20, 61), point(30, 62)], null, state)).toHaveLength(1);
    expect(run([point(40, 40), point(400, 60), point(411, 60)], null, state)).toHaveLength(1);
  });

  it('honours the cooldown between episodes', () => {
    const state = newSafetyState();
    expect(run([point(0, 60), point(10, 60), point(20, 40), point(30, 60), point(45, 60)], null, state)).toHaveLength(
      1,
    );
  });

  it('is high severity 20 km/h above the limit and uses the per-device limit', () => {
    const found = run([point(0, 72), point(12, 72)]);
    expect(found[0].severity).toBe('high');
    expect(run([point(0, 45), point(12, 45)], null, newSafetyState(), { ...settings, speed_limit_kmh: 40 })).toEqual([
      expect.objectContaining({ kind: 'overspeed', limit: 40 }),
    ]);
  });

  it('ignores points older than the last one', () => {
    const state = newSafetyState();
    run([point(10, 60)], null, state);
    expect(run([point(5, 90), point(9, 90)], null, state)).toEqual([]);
  });
});

describe('harsh braking', () => {
  it('measures the speed drop per second between consecutive points', () => {
    expect(brakingRate(point(0, 40), point(2, 10))).toBe(15);
    expect(brakingRate(point(0, 15), point(1, 0))).toBeNull();
    expect(brakingRate(point(0, 40), point(20, 0))).toBeNull();
    const found = run([point(0, 42), point(2, 14)]);
    expect(found).toEqual([
      expect.objectContaining({ kind: 'harsh_braking', severity: 'medium', value: 14, limit: 12 }),
    ]);
  });

  it('is high when the drop is 1.5 times the threshold, quiet for gentle braking', () => {
    expect(run([point(0, 45), point(1, 25)])[0]).toMatchObject({ severity: 'high', value: 20 });
    expect(run([point(0, 40), point(4, 20)])).toEqual([]);
  });

  it('accepts the tracker harsh_brake flag and de-duplicates within the cooldown', () => {
    const state = newSafetyState();
    const found = run([point(0, 30, { event: 'harsh_brake' }), point(30, 30, { event: 'harsh_brake' })], null, state);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      kind: 'harsh_braking',
      value: null,
      message: 'Harsh braking reported by the tracker',
    });
  });
});

describe('long idle', () => {
  it('counts only during a trip with the engine on and the bus still', () => {
    const idle = [point(0, 0), point(120, 1), point(299, 0)];
    expect(run([...idle, point(300, 0)])).toEqual([]);
    const found = run([...idle, point(300, 0)], straightTrip);
    expect(found).toEqual([expect.objectContaining({ kind: 'idle', severity: 'low', value: 5, limit: 5 })]);
    expect(run([point(0, 0, { ignition: false }), point(600, 0, { ignition: false })], straightTrip)).toEqual([]);
  });

  it('starts again after the bus moves', () => {
    const state = newSafetyState();
    run([point(0, 0), point(200, 0)], straightTrip, state);
    expect(run([point(210, 20), point(220, 0), point(500, 0)], straightTrip, state)).toEqual([]);
  });
});

describe('route deviation', () => {
  it('measures the distance to the nearest path segment', () => {
    expect(distanceToPathMeters({ lat: 13.08, lng: 80.22 }, straightTrip.path)).toBeLessThan(1);
    const off = distanceToPathMeters({ lat: 13.085, lng: 80.22 }, straightTrip.path);
    expect(off).toBeGreaterThan(540);
    expect(off).toBeLessThan(570);
  });

  it('raises after deviation_seconds off the path, then waits for the bus to return', () => {
    const off = { lat: 13.085, lng: 80.22 };
    const state = newSafetyState();
    expect(run([point(0, 25, off), point(20, 25, off)], straightTrip, state)).toEqual([]);
    const found = run([point(30, 25, off)], straightTrip, state);
    expect(found).toEqual([
      expect.objectContaining({
        kind: 'route_deviation',
        severity: 'medium',
        limit: 300,
        position: expect.any(Object),
      }),
    ]);
    expect(found[0].value).toBeGreaterThan(540);
    expect(run([point(60, 25, off)], straightTrip, state)).toEqual([]);
  });

  it('is skipped without a trip or before the first stop of a pickup', () => {
    const off = { lat: 13.1, lng: 80.22 };
    expect(run([point(0, 25, off), point(60, 25, off)])).toEqual([]);
    expect(run([point(0, 25, off), point(60, 25, off)], { ...straightTrip, check_deviation: false })).toEqual([]);
    expect(run([point(0, 25, off), point(60, 25, off)], straightTrip)[0].severity).toBe('high');
  });

  it('builds the path in travel order', () => {
    const stops = [
      { lat: 1, lng: 1, status: 'pending' },
      { lat: 2, lng: 2, status: 'pending' },
    ];
    const school = { lat: 9, lng: 9 };
    expect(tripPath('pickup', stops, school)).toEqual([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, school]);
    expect(tripPath('drop', stops, school)).toEqual([school, { lat: 1, lng: 1 }, { lat: 2, lng: 2 }]);
    expect(deviationApplies('pickup', stops)).toBe(false);
    expect(deviationApplies('pickup', [{ ...stops[0], status: 'arrived' }, stops[1]])).toBe(true);
    expect(deviationApplies('drop', stops)).toBe(true);
  });
});

describe('alert.raised webhook body', () => {
  it('matches the School API contract', () => {
    const [item] = run([point(0, 62), point(12, 62)]);
    const trip = { id: 7, ref: 'TZMS-41', device_id: 1, kind: 'pickup' as const, path: [], check_deviation: true };
    expect(alertBody(31, 1, trip, item)).toEqual({
      id: 31,
      type: 'alert.raised',
      at: new Date(T0 + 12000),
      trip: { id: 7, ref: 'TZMS-41', device_id: 1, kind: 'pickup' },
      device_id: 1,
      alert: {
        kind: 'overspeed',
        severity: 'medium',
        message: 'Overspeed: 62 km/h for 12 s (limit 50 km/h)',
        value: 62,
        limit: 50,
        position: { lat: 13.08, lng: 80.2, speed_kmh: 62 },
      },
    });
    const harsh = run([point(0, 30, { event: 'harsh_brake', speed: null })])[0];
    expect(alertBody(32, 1, null, harsh)).toEqual({
      id: 32,
      type: 'alert.raised',
      at: new Date(T0),
      trip: null,
      device_id: 1,
      alert: {
        kind: 'harsh_braking',
        severity: 'medium',
        message: 'Harsh braking reported by the tracker',
        limit: 12,
        position: { lat: 13.08, lng: 80.2 },
      },
    });
  });
});

describe('playback track', () => {
  it('thins long tracks evenly and keeps the first and last point', () => {
    const items = Array.from({ length: 1001 }, (_, index) => index);
    const picked = downsample(items, 101);
    expect(picked).toHaveLength(101);
    expect(picked[0]).toBe(0);
    expect(picked[100]).toBe(1000);
    expect(picked[50]).toBe(500);
    expect(downsample([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it('measures distance, duration and speeds over every point', () => {
    const at = (s: number) => new Date(T0 + s * 1000);
    const stats = trackStats([
      { at: at(0), lat: 13.08, lng: 80.2, speed: 0, heading: 90 },
      { at: at(60), lat: 13.08, lng: 80.21, speed: 40, heading: 90 },
      { at: at(120), lat: 13.08, lng: 80.22, speed: 30, heading: 90 },
    ]);
    expect(stats.distance_km).toBeCloseTo(2.17, 1);
    expect(stats).toMatchObject({ duration_seconds: 120, max_speed: 40 });
    expect(stats.avg_speed).toBeCloseTo(65, 0);
    expect(trackStats([])).toEqual({ distance_km: 0, duration_seconds: 0, max_speed: null, avg_speed: null });
  });
});
