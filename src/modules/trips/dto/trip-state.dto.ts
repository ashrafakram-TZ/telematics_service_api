import { ApiProperty } from '@nestjs/swagger';
import {
  END_REASONS,
  EndReason,
  POSITION_SOURCES,
  PositionSource,
  STOP_STATUSES,
  StopStatus,
  TRIP_EVENT_TYPES,
  TRIP_KINDS,
  TRIP_STATUSES,
  TripEventType,
  TripKind,
  TripStatus,
} from '../trip-engine';

export class TripPositionDto {
  @ApiProperty({ example: 13.08 })
  lat: number;

  @ApiProperty({ example: 80.19 })
  lng: number;

  @ApiProperty({ example: 28, nullable: true, type: Number, description: 'km/h' })
  speed: number | null;

  @ApiProperty({ example: 90, nullable: true, type: Number })
  heading: number | null;

  @ApiProperty({ example: '2026-11-09T07:12:30.000+05:30' })
  recorded_at: Date;

  @ApiProperty({ enum: POSITION_SOURCES, example: 'device' })
  source: PositionSource;
}

export class TripStopStateDto {
  @ApiProperty({ example: '12' })
  ref: string;

  @ApiProperty({ example: 'Mogappair East bus stand' })
  name: string;

  @ApiProperty({ example: 1 })
  sequence: number;

  @ApiProperty({ enum: STOP_STATUSES, example: 'pending' })
  status: StopStatus;

  @ApiProperty({ example: 300, nullable: true, type: Number, description: 'Seconds until the bus reaches this stop' })
  eta_seconds: number | null;

  @ApiProperty({ example: 2100, nullable: true, type: Number, description: 'Remaining path distance in metres' })
  distance_m: number | null;

  @ApiProperty({ example: null, nullable: true, type: Date })
  approached_at: Date | null;

  @ApiProperty({ example: null, nullable: true, type: Date })
  arrived_at: Date | null;

  @ApiProperty({ example: null, nullable: true, type: Date })
  departed_at: Date | null;

  @ApiProperty({ example: 13.0846 })
  lat: number;

  @ApiProperty({ example: 80.1767 })
  lng: number;

  @ApiProperty({ example: 120 })
  radius_m: number;

  @ApiProperty({ example: '07:00', nullable: true, type: String })
  planned_time: string | null;
}

export class TripDestinationDto {
  @ApiProperty({ example: 'Tamilzorous Model School' })
  name: string;

  @ApiProperty({ example: 13.0878 })
  lat: number;

  @ApiProperty({ example: 80.2101 })
  lng: number;

  @ApiProperty({ example: 200 })
  radius_m: number;
}

export class TripStateDto {
  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({ example: 'TZMS-41' })
  ref: string;

  @ApiProperty({ example: 1 })
  device_id: number;

  @ApiProperty({ enum: TRIP_KINDS, example: 'pickup' })
  kind: TripKind;

  @ApiProperty({ enum: TRIP_STATUSES, example: 'active' })
  status: TripStatus;

  @ApiProperty({ example: '2026-11-09T06:55:00.000+05:30' })
  started_at: Date;

  @ApiProperty({ example: null, nullable: true, type: Date })
  ended_at: Date | null;

  @ApiProperty({ enum: END_REASONS, example: null, nullable: true })
  end_reason: EndReason | null;

  @ApiProperty({ type: TripPositionDto, nullable: true })
  position: TripPositionDto | null;

  @ApiProperty({ example: '12', nullable: true, type: String, description: 'First stop not yet departed or skipped' })
  next_stop_ref: string | null;

  @ApiProperty({
    example: 1260,
    nullable: true,
    type: Number,
    description: 'Pickup: seconds to the destination. Drop: null (the trip ends at the last stop).',
  })
  destination_eta_seconds: number | null;

  @ApiProperty({ type: [TripStopStateDto] })
  stops: TripStopStateDto[];

  @ApiProperty({ type: TripDestinationDto })
  destination: TripDestinationDto;

  @ApiProperty({ example: 5 })
  approach_minutes: number;

  @ApiProperty({ example: 800 })
  approach_metres: number;

  @ApiProperty({ example: 'Ganesan Pillai', nullable: true, type: String })
  started_by: string | null;
}

export class TripWebhookTripDto {
  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({ example: 'TZMS-41' })
  ref: string;

  @ApiProperty({ example: 1 })
  device_id: number;

  @ApiProperty({ enum: TRIP_KINDS, example: 'pickup' })
  kind: TripKind;
}

export class TripWebhookStopDto {
  @ApiProperty({ example: '12' })
  ref: string;

  @ApiProperty({ example: 'Mogappair East bus stand' })
  name: string;

  @ApiProperty({ example: 1 })
  sequence: number;
}

export class TripWebhookEventDto {
  @ApiProperty({ example: 1501, description: 'trip_events id; 0 for trip.position (not stored)' })
  id: number;

  @ApiProperty({ enum: TRIP_EVENT_TYPES, example: 'stop.approaching' })
  type: TripEventType;

  @ApiProperty({ example: '2026-11-09T07:12:30.000+05:30' })
  at: string;

  @ApiProperty({ type: TripWebhookTripDto })
  trip: TripWebhookTripDto;

  @ApiProperty({ type: TripWebhookStopDto, nullable: true, description: 'Only on stop.* events' })
  stop: TripWebhookStopDto | null;

  @ApiProperty({ example: 280, nullable: true, type: Number })
  eta_seconds: number | null;

  @ApiProperty({ type: TripPositionDto, nullable: true })
  position: TripPositionDto | null;

  @ApiProperty({ enum: END_REASONS, example: null, nullable: true, description: 'Only on trip.ended' })
  end_reason: EndReason | null;
}
