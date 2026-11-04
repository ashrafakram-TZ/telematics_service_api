import { distanceToPathMeters, GeoPoint } from '../../common/utils/geo';

export const SAFETY_KINDS = ['overspeed', 'harsh_braking', 'idle', 'route_deviation'] as const;
export type SafetyKind = (typeof SAFETY_KINDS)[number];

export const SAFETY_SEVERITIES = ['low', 'medium', 'high'] as const;
export type SafetySeverity = (typeof SAFETY_SEVERITIES)[number];

export const IDLE_SPEED_KMPH = 3;
export const HARSH_BRAKE_MIN_START_KMPH = 20;
export const HARSH_BRAKE_MAX_GAP_MS = 10 * 1000;
export const OVERSPEED_HIGH_MARGIN_KMPH = 20;

export interface SafetySettings {
  speed_limit_kmh: number;
  overspeed_seconds: number;
  harsh_brake_kmh_per_s: number;
  idle_minutes: number;
  deviation_m: number;
  deviation_seconds: number;
  cooldown_seconds: number;
}

export interface SafetyPoint extends GeoPoint {
  at: number;
  speed: number | null;
  ignition: boolean | null;
  event: string | null;
}

export interface SafetyTrip {
  path: GeoPoint[];
  check_deviation: boolean;
}

export interface SafetyState {
  last: SafetyPoint | null;
  overspeed_since: number | null;
  overspeed_peak: number;
  overspeed_raised: boolean;
  idle_since: number | null;
  idle_raised: boolean;
  deviation_since: number | null;
  deviation_peak: number;
  deviation_raised: boolean;
  last_raised: Partial<Record<SafetyKind, number>>;
}

export interface SafetyFinding {
  kind: SafetyKind;
  severity: SafetySeverity;
  message: string;
  value: number | null;
  limit: number | null;
  at: Date;
  position: { lat: number; lng: number; speed_kmh: number | null };
}

export function newSafetyState(): SafetyState {
  return {
    last: null,
    overspeed_since: null,
    overspeed_peak: 0,
    overspeed_raised: false,
    idle_since: null,
    idle_raised: false,
    deviation_since: null,
    deviation_peak: 0,
    deviation_raised: false,
    last_raised: {},
  };
}

const round = (value: number, digits = 0) => Math.round(value * 10 ** digits) / 10 ** digits;

function coolingDown(state: SafetyState, kind: SafetyKind, at: number, settings: SafetySettings): boolean {
  const last = state.last_raised[kind];
  return last !== undefined && at - last < settings.cooldown_seconds * 1000;
}

function finding(
  point: SafetyPoint,
  kind: SafetyKind,
  severity: SafetySeverity,
  message: string,
  value: number | null,
  limit: number | null,
): SafetyFinding {
  return {
    kind,
    severity,
    message,
    value,
    limit,
    at: new Date(point.at),
    position: { lat: point.lat, lng: point.lng, speed_kmh: point.speed === null ? null : round(point.speed, 1) },
  };
}

export function overspeedSeverity(speed: number, limit: number): SafetySeverity {
  return speed >= limit + OVERSPEED_HIGH_MARGIN_KMPH ? 'high' : 'medium';
}

function checkOverspeed(state: SafetyState, point: SafetyPoint, settings: SafetySettings): SafetyFinding | null {
  const limit = settings.speed_limit_kmh;
  if (point.speed === null || point.speed <= limit) {
    state.overspeed_since = null;
    state.overspeed_peak = 0;
    state.overspeed_raised = false;
    return null;
  }
  if (state.overspeed_since === null) state.overspeed_since = point.at;
  state.overspeed_peak = Math.max(state.overspeed_peak, point.speed);
  const seconds = (point.at - state.overspeed_since) / 1000;
  if (state.overspeed_raised || seconds < settings.overspeed_seconds) return null;
  if (coolingDown(state, 'overspeed', point.at, settings)) return null;
  state.overspeed_raised = true;
  const peak = round(state.overspeed_peak);
  return finding(
    point,
    'overspeed',
    overspeedSeverity(peak, limit),
    `Overspeed: ${peak} km/h for ${round(seconds)} s (limit ${limit} km/h)`,
    peak,
    limit,
  );
}

export function brakingRate(previous: SafetyPoint | null, point: SafetyPoint): number | null {
  if (!previous || previous.speed === null || point.speed === null) return null;
  const gap = point.at - previous.at;
  if (gap <= 0 || gap > HARSH_BRAKE_MAX_GAP_MS || previous.speed < HARSH_BRAKE_MIN_START_KMPH) return null;
  return (previous.speed - point.speed) / (gap / 1000);
}

function checkHarshBraking(state: SafetyState, point: SafetyPoint, settings: SafetySettings): SafetyFinding | null {
  const rate = brakingRate(state.last, point);
  const threshold = settings.harsh_brake_kmh_per_s;
  const measured = rate !== null && rate >= threshold;
  if (!measured && point.event !== 'harsh_brake') return null;
  if (coolingDown(state, 'harsh_braking', point.at, settings)) return null;
  const value = rate !== null && rate > 0 ? round(rate, 1) : null;
  const severity: SafetySeverity = value !== null && value >= threshold * 1.5 ? 'high' : 'medium';
  const message =
    value !== null && measured
      ? `Harsh braking: speed fell ${value} km/h per second (from ${round(state.last!.speed!)} to ${round(point.speed!)} km/h)`
      : 'Harsh braking reported by the tracker';
  return finding(point, 'harsh_braking', severity, message, value, threshold);
}

function checkIdle(
  state: SafetyState,
  point: SafetyPoint,
  settings: SafetySettings,
  trip: SafetyTrip | null,
): SafetyFinding | null {
  const idling = trip !== null && point.ignition !== false && (point.speed ?? 0) <= IDLE_SPEED_KMPH;
  if (!idling) {
    state.idle_since = null;
    state.idle_raised = false;
    return null;
  }
  if (state.idle_since === null) state.idle_since = point.at;
  const minutes = (point.at - state.idle_since) / 60000;
  if (state.idle_raised || minutes < settings.idle_minutes) return null;
  if (coolingDown(state, 'idle', point.at, settings)) return null;
  state.idle_raised = true;
  const shown = Math.floor(minutes);
  return finding(
    point,
    'idle',
    minutes >= settings.idle_minutes * 3 ? 'medium' : 'low',
    `Idling for ${shown} min with the engine on during a trip`,
    shown,
    settings.idle_minutes,
  );
}

function checkDeviation(
  state: SafetyState,
  point: SafetyPoint,
  settings: SafetySettings,
  trip: SafetyTrip | null,
): SafetyFinding | null {
  const distance = trip && trip.check_deviation && trip.path.length ? distanceToPathMeters(point, trip.path) : 0;
  if (distance <= settings.deviation_m) {
    state.deviation_since = null;
    state.deviation_peak = 0;
    state.deviation_raised = false;
    return null;
  }
  if (state.deviation_since === null) state.deviation_since = point.at;
  state.deviation_peak = Math.max(state.deviation_peak, distance);
  if (state.deviation_raised || point.at - state.deviation_since < settings.deviation_seconds * 1000) return null;
  if (coolingDown(state, 'route_deviation', point.at, settings)) return null;
  state.deviation_raised = true;
  const metres = round(state.deviation_peak);
  return finding(
    point,
    'route_deviation',
    metres >= settings.deviation_m * 2 ? 'high' : 'medium',
    `Off route by ${metres} m (allowed ${settings.deviation_m} m)`,
    metres,
    settings.deviation_m,
  );
}

export function evaluateSafety(
  state: SafetyState,
  point: SafetyPoint,
  settings: SafetySettings,
  trip: SafetyTrip | null,
): SafetyFinding[] {
  if (state.last && point.at <= state.last.at) return [];
  const findings = [
    checkOverspeed(state, point, settings),
    checkHarshBraking(state, point, settings),
    checkIdle(state, point, settings, trip),
    checkDeviation(state, point, settings, trip),
  ].filter((item): item is SafetyFinding => item !== null);
  for (const item of findings) state.last_raised[item.kind] = point.at;
  state.last = point;
  return findings;
}

export interface PathStop extends GeoPoint {
  status: string;
}

export function tripPath(kind: 'pickup' | 'drop', stops: PathStop[], destination: GeoPoint): GeoPoint[] {
  const points = stops.map((stop) => ({ lat: stop.lat, lng: stop.lng }));
  const school = { lat: destination.lat, lng: destination.lng };
  return kind === 'pickup' ? [...points, school] : [school, ...points];
}

export function deviationApplies(kind: 'pickup' | 'drop', stops: PathStop[]): boolean {
  if (kind === 'drop') return true;
  return stops.some((stop) => stop.status === 'arrived' || stop.status === 'departed' || stop.status === 'skipped');
}
