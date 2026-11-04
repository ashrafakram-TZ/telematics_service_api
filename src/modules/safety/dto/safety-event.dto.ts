import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { DELIVERY_STATUSES, DeliveryStatus } from '../../trips/entities/trip-event.entity';
import { FAULT_SEVERITIES, FaultSeverity } from '../../obd/obd-faults';
import { TRIP_KINDS, TripKind } from '../../trips/trip-engine';
import { TelemetryQueryDto } from '../../telemetry/dto/telemetry-query.dto';
import { SAFETY_KINDS, SAFETY_SEVERITIES, SafetyKind, SafetySeverity } from '../safety-rules';

export class SafetyEventDto {
  @ApiProperty({ example: 31 })
  id: number;

  @ApiProperty({ example: 1 })
  device_id: number;

  @ApiProperty({ example: 7, nullable: true, type: Number, description: 'Active trip when it happened' })
  trip_id: number | null;

  @ApiProperty({ enum: SAFETY_KINDS, example: 'overspeed' })
  kind: SafetyKind;

  @ApiProperty({ enum: SAFETY_SEVERITIES, example: 'medium' })
  severity: SafetySeverity;

  @ApiProperty({ example: 'Overspeed: 62 km/h for 12 s (limit 50 km/h)' })
  message: string;

  @ApiProperty({
    example: 62,
    nullable: true,
    type: Number,
    description: 'overspeed: peak km/h; harsh_braking: km/h lost per second; idle: minutes; route_deviation: metres',
  })
  value: number | null;

  @ApiProperty({ example: 50, nullable: true, type: Number, description: 'The threshold that was crossed' })
  limit: number | null;

  @ApiProperty({ example: 13.0849 })
  lat: number;

  @ApiProperty({ example: 80.2105 })
  lng: number;

  @ApiProperty({ example: 62, nullable: true, type: Number })
  speed_kmh: number | null;

  @ApiProperty({ example: '2026-11-09T07:12:30.000+05:30' })
  occurred_at: Date;

  @ApiProperty({ enum: DELIVERY_STATUSES, example: 'delivered', description: 'alert.raised webhook delivery' })
  delivery_status: DeliveryStatus;
}

export class SafetyQueryDto extends TelemetryQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  device_id?: number;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  trip_id?: number;

  @ApiPropertyOptional({ enum: SAFETY_KINDS })
  @IsOptional()
  @IsIn(SAFETY_KINDS)
  kind?: SafetyKind;

  @ApiPropertyOptional({ enum: SAFETY_SEVERITIES })
  @IsOptional()
  @IsIn(SAFETY_SEVERITIES)
  severity?: SafetySeverity;
}

export class AlertPositionDto {
  @ApiProperty({ example: 13.0849 })
  lat: number;

  @ApiProperty({ example: 80.2105 })
  lng: number;

  @ApiProperty({ example: 62, nullable: true, type: Number })
  speed_kmh: number | null;
}

export class AlertBodyDto {
  @ApiProperty({ enum: SAFETY_KINDS })
  kind: SafetyKind;

  @ApiProperty({ enum: SAFETY_SEVERITIES })
  severity: SafetySeverity;

  @ApiProperty({ example: 'Overspeed: 62 km/h for 12 s (limit 50 km/h)' })
  message: string;

  @ApiPropertyOptional({ example: 62 })
  value?: number;

  @ApiPropertyOptional({ example: 50 })
  limit?: number;

  @ApiPropertyOptional({ type: AlertPositionDto })
  position?: AlertPositionDto;
}

export class AlertTripRefDto {
  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({ example: 'TZMS-41' })
  ref: string;

  @ApiProperty({ example: 1 })
  device_id: number;

  @ApiProperty({ enum: TRIP_KINDS })
  kind: TripKind;
}

export class AlertRaisedWebhookDto {
  @ApiProperty({ example: 31, description: 'safety_events id, for de-duplication' })
  id: number;

  @ApiProperty({ example: 'alert.raised', enum: ['alert.raised'] })
  type: 'alert.raised';

  @ApiProperty({ example: '2026-11-09T07:12:30.000+05:30' })
  at: string;

  @ApiProperty({ type: AlertTripRefDto, nullable: true })
  trip: AlertTripRefDto | null;

  @ApiProperty({ example: 1 })
  device_id: number;

  @ApiProperty({ type: AlertBodyDto })
  alert: AlertBodyDto;
}

export class VehicleFaultBodyDto {
  @ApiProperty({ example: 'P0217' })
  code: string;

  @ApiProperty({ example: 'Engine coolant over temperature' })
  description: string;

  @ApiProperty({ enum: FAULT_SEVERITIES, example: 'high' })
  severity: FaultSeverity;
}

export class VehicleFaultWebhookDto {
  @ApiProperty({ example: 12, description: 'vehicle_faults id, for de-duplication' })
  id: number;

  @ApiProperty({ example: 'vehicle.fault', enum: ['vehicle.fault'] })
  type: 'vehicle.fault';

  @ApiProperty({ example: '2026-11-09T07:12:30.000+05:30' })
  at: string;

  @ApiProperty({ example: 1 })
  device_id: number;

  @ApiProperty({ type: VehicleFaultBodyDto })
  fault: VehicleFaultBodyDto;

  @ApiPropertyOptional({ example: 48213.7 })
  odometer_km?: number;
}
