import { TripPositionDto, TripStateDto, TripWebhookEventDto } from './dto/trip-state.dto';
import { Trip } from './entities/trip.entity';
import { TripStop } from './entities/trip-stop.entity';
import { EndReason, EngineTrip, TripEventType } from './trip-engine';

export function engineView(trip: Trip): EngineTrip {
  return {
    kind: trip.kind,
    started_at: trip.started_at,
    approach_minutes: trip.approach_minutes,
    approach_metres: trip.approach_metres,
    destination: { lat: trip.destination_lat, lng: trip.destination_lng, radius_m: trip.destination_radius_m },
    stops: trip.stops,
  };
}

export function tripPosition(trip: Trip): TripPositionDto | null {
  if (trip.position_lat === null || trip.position_lng === null || !trip.position_at) return null;
  return {
    lat: trip.position_lat,
    lng: trip.position_lng,
    speed: trip.position_speed,
    heading: trip.position_heading,
    recorded_at: trip.position_at,
    source: trip.position_source ?? 'device',
  };
}

export function toTripState(trip: Trip): TripStateDto {
  return {
    id: trip.id,
    ref: trip.ref,
    device_id: trip.device_id,
    kind: trip.kind,
    status: trip.status,
    started_at: trip.started_at,
    ended_at: trip.ended_at,
    end_reason: trip.end_reason,
    position: tripPosition(trip),
    next_stop_ref: trip.next_stop_ref,
    destination_eta_seconds: trip.destination_eta_seconds,
    stops: trip.stops.map((stop) => ({
      ref: stop.ref,
      name: stop.name,
      sequence: stop.sequence,
      status: stop.status,
      eta_seconds: stop.eta_seconds,
      distance_m: stop.distance_m,
      approached_at: stop.approached_at,
      arrived_at: stop.arrived_at,
      departed_at: stop.departed_at,
      lat: stop.lat,
      lng: stop.lng,
      radius_m: stop.radius_m,
      planned_time: stop.planned_time,
    })),
    destination: {
      name: trip.destination_name,
      lat: trip.destination_lat,
      lng: trip.destination_lng,
      radius_m: trip.destination_radius_m,
    },
    approach_minutes: trip.approach_minutes,
    approach_metres: trip.approach_metres,
    started_by: trip.started_by,
  };
}

export interface WebhookEventInput {
  type: TripEventType;
  at: Date;
  stop?: TripStop | null;
  eta_seconds?: number | null;
  end_reason?: EndReason | null;
}

export type TripWebhookBody = Omit<TripWebhookEventDto, 'at' | 'position'> & {
  at: Date;
  position: TripPositionDto | null;
};

export function webhookBody(id: number, trip: Trip, input: WebhookEventInput): TripWebhookBody {
  return {
    id,
    type: input.type,
    at: input.at,
    trip: { id: trip.id, ref: trip.ref, device_id: trip.device_id, kind: trip.kind },
    stop: input.stop ? { ref: input.stop.ref, name: input.stop.name, sequence: input.stop.sequence } : null,
    eta_seconds: input.eta_seconds ?? null,
    position: tripPosition(trip),
    end_reason: input.end_reason ?? null,
  };
}
