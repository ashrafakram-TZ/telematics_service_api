import { GeoPoint, haversineMeters } from '../../common/utils/geo';

export const TRIP_KINDS = ['pickup', 'drop'] as const;
export type TripKind = (typeof TRIP_KINDS)[number];

export const TRIP_STATUSES = ['active', 'ended'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const STOP_STATUSES = ['pending', 'approaching', 'arrived', 'departed', 'skipped'] as const;
export type StopStatus = (typeof STOP_STATUSES)[number];

export const END_REASONS = ['arrived_school', 'route_complete', 'driver', 'admin', 'timeout'] as const;
export type EndReason = (typeof END_REASONS)[number];

export const MANUAL_END_REASONS = ['driver', 'admin'] as const;
export type ManualEndReason = (typeof MANUAL_END_REASONS)[number];

export const TRIP_EVENT_TYPES = [
  'trip.started',
  'trip.position',
  'stop.approaching',
  'stop.arrived',
  'stop.departed',
  'trip.ended',
] as const;
export type TripEventType = (typeof TRIP_EVENT_TYPES)[number];

export type StopEventType = Extract<TripEventType, `stop.${string}`>;

export const POSITION_SOURCES = ['device', 'phone'] as const;
export type PositionSource = (typeof POSITION_SOURCES)[number];

export const MIN_ETA_KMPH = 12;
export const MAX_ETA_KMPH = 40;
export const SPEED_WINDOW_MS = 2 * 60 * 1000;
export const AUTO_END_AFTER_MS = 3 * 60 * 1000;

export interface Fence extends GeoPoint {
  radius_m: number;
}

export interface EngineStop extends Fence {
  id: number;
  sequence: number;
  status: StopStatus;
  eta_seconds: number | null;
  distance_m: number | null;
  approached_at: Date | null;
  arrived_at: Date | null;
  departed_at: Date | null;
}

export interface EngineTrip {
  kind: TripKind;
  started_at: Date;
  approach_minutes: number;
  approach_metres: number;
  destination: Fence;
  stops: EngineStop[];
}

export interface EnginePoint extends GeoPoint {
  recorded_at: Date;
}

export interface StopEvent {
  type: StopEventType;
  stop_id: number;
  eta_seconds: number | null;
}

export interface EngineResult {
  events: StopEvent[];
  end_reason: EndReason | null;
  destination_eta_seconds: number | null;
  next_stop_id: number | null;
}

export interface SpeedSample {
  at: number;
  speed: number;
}

const isOpen = (stop: EngineStop) => stop.status === 'pending' || stop.status === 'approaching';
const isDone = (stop: EngineStop) => stop.status === 'departed' || stop.status === 'skipped';
const inside = (point: GeoPoint, fence: Fence) => haversineMeters(point, fence) <= fence.radius_m;

export function etaSpeedKmph(samples: number[]): number {
  const valid = samples.filter((speed) => Number.isFinite(speed) && speed >= 0);
  const average = valid.length ? valid.reduce((sum, speed) => sum + speed, 0) / valid.length : 0;
  return Math.min(MAX_ETA_KMPH, Math.max(MIN_ETA_KMPH, average));
}

export function recentSpeeds(samples: SpeedSample[], at: number): SpeedSample[] {
  return samples.filter((sample) => sample.at > at - SPEED_WINDOW_MS && sample.at <= at);
}

export function nextStopId(trip: EngineTrip): number | null {
  return trip.stops.find((stop) => !isDone(stop))?.id ?? null;
}

function approach(stop: EngineStop, at: Date, eta: number | null, events: StopEvent[]): void {
  stop.status = 'approaching';
  stop.approached_at = at;
  events.push({ type: 'stop.approaching', stop_id: stop.id, eta_seconds: eta });
}

function depart(stop: EngineStop, at: Date, events: StopEvent[]): void {
  stop.status = 'departed';
  stop.departed_at = at;
  stop.eta_seconds = null;
  stop.distance_m = null;
  events.push({ type: 'stop.departed', stop_id: stop.id, eta_seconds: null });
}

function skip(stop: EngineStop): void {
  stop.status = 'skipped';
  stop.eta_seconds = null;
  stop.distance_m = null;
}

export function closeStops(trip: EngineTrip, at: Date): StopEvent[] {
  const events: StopEvent[] = [];
  for (const stop of trip.stops) {
    if (stop.status === 'arrived') depart(stop, at, events);
    else if (isOpen(stop)) skip(stop);
  }
  return events;
}

function updateEtas(trip: EngineTrip, point: EnginePoint, speedKmph: number): number | null {
  const metresPerSecond = speedKmph / 3.6;
  let cursor: GeoPoint = point;
  let travelled = 0;
  for (const stop of trip.stops) {
    if (stop.status === 'arrived') {
      stop.distance_m = Math.round(haversineMeters(point, stop));
      stop.eta_seconds = 0;
      continue;
    }
    if (!isOpen(stop)) {
      stop.eta_seconds = null;
      stop.distance_m = null;
      continue;
    }
    travelled += haversineMeters(cursor, stop);
    cursor = stop;
    stop.distance_m = Math.round(travelled);
    stop.eta_seconds = Math.round(travelled / metresPerSecond);
  }
  if (trip.kind !== 'pickup') return null;
  return Math.round((travelled + haversineMeters(cursor, trip.destination)) / metresPerSecond);
}

function endReason(trip: EngineTrip, point: EnginePoint): EndReason | null {
  if (trip.kind === 'drop') return trip.stops[trip.stops.length - 1]?.status === 'departed' ? 'route_complete' : null;
  if (!inside(point, trip.destination)) return null;
  const stopsDone = trip.stops.every(isDone);
  const runningLongEnough = point.recorded_at.getTime() - trip.started_at.getTime() > AUTO_END_AFTER_MS;
  return stopsDone || runningLongEnough ? 'arrived_school' : null;
}

export function advanceTrip(trip: EngineTrip, point: EnginePoint, speedKmph: number): EngineResult {
  const at = point.recorded_at;
  const events: StopEvent[] = [];
  const target = trip.stops.find((stop) => isOpen(stop) && inside(point, stop));

  for (const stop of trip.stops) {
    if (stop.status !== 'arrived') continue;
    if (!inside(point, stop) || (target && target.sequence > stop.sequence)) depart(stop, at, events);
  }

  if (target) {
    for (const stop of trip.stops) if (isOpen(stop) && stop.sequence < target.sequence) skip(stop);
    if (target.status === 'pending') approach(target, at, 0, events);
    target.status = 'arrived';
    target.arrived_at = at;
    events.push({ type: 'stop.arrived', stop_id: target.id, eta_seconds: 0 });
  }

  let destinationEta = updateEtas(trip, point, speedKmph);

  for (const stop of trip.stops) {
    if (stop.status !== 'pending' || inside(point, stop)) continue;
    const etaDue = stop.eta_seconds !== null && stop.eta_seconds <= trip.approach_minutes * 60;
    const distanceDue = stop.distance_m !== null && stop.distance_m <= trip.approach_metres;
    if (etaDue || distanceDue) approach(stop, at, stop.eta_seconds, events);
  }

  const reason = endReason(trip, point);
  if (reason) {
    events.push(...closeStops(trip, at));
    destinationEta = trip.kind === 'pickup' ? 0 : null;
  }

  return {
    events,
    end_reason: reason,
    destination_eta_seconds: destinationEta,
    next_stop_id: reason ? null : nextStopId(trip),
  };
}
