import { TripKind } from '../trips/trip-engine';
import { SafetyEventDto } from './dto/safety-event.dto';
import { SafetyEvent } from './entities/safety-event.entity';
import { SafetyFinding } from './safety-rules';

export interface AlertTripRef {
  id: number;
  ref: string;
  device_id: number;
  kind: TripKind;
}

export interface AlertRaisedBody {
  id: number;
  type: 'alert.raised';
  at: Date;
  trip: AlertTripRef | null;
  device_id: number;
  alert: {
    kind: SafetyFinding['kind'];
    severity: SafetyFinding['severity'];
    message: string;
    value?: number;
    limit?: number;
    position?: { lat: number; lng: number; speed_kmh?: number };
  };
}

export function alertBody(
  id: number,
  deviceId: number,
  trip: AlertTripRef | null,
  item: SafetyFinding,
): AlertRaisedBody {
  return {
    id,
    type: 'alert.raised',
    at: item.at,
    trip: trip ? { id: trip.id, ref: trip.ref, device_id: trip.device_id, kind: trip.kind } : null,
    device_id: deviceId,
    alert: {
      kind: item.kind,
      severity: item.severity,
      message: item.message,
      ...(item.value !== null ? { value: item.value } : {}),
      ...(item.limit !== null ? { limit: item.limit } : {}),
      position: {
        lat: item.position.lat,
        lng: item.position.lng,
        ...(item.position.speed_kmh !== null ? { speed_kmh: item.position.speed_kmh } : {}),
      },
    },
  };
}

export function toSafetyEventDto(row: SafetyEvent): SafetyEventDto {
  return {
    id: row.id,
    device_id: row.device_id,
    trip_id: row.trip_id,
    kind: row.kind,
    severity: row.severity,
    message: row.message,
    value: row.value,
    limit: row.limit_value,
    lat: row.lat,
    lng: row.lng,
    speed_kmh: row.speed,
    occurred_at: row.occurred_at,
    delivery_status: row.delivery_status,
  };
}
