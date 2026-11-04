import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { DELIVERY_STATUSES, DeliveryStatus } from '../../trips/entities/trip-event.entity';
import { TelemetryQueryDto } from '../../telemetry/dto/telemetry-query.dto';
import { FAULT_SEVERITIES, FaultSeverity, HEALTH_STATUSES, HealthStatus } from '../obd-faults';

export const FAULT_FILTERS = ['open', 'cleared'] as const;
export type FaultFilter = (typeof FAULT_FILTERS)[number];

export class ActiveFaultDto {
  @ApiProperty({ example: 'P0217' })
  code: string;

  @ApiProperty({ example: 'Engine coolant over temperature' })
  description: string;

  @ApiProperty({ enum: FAULT_SEVERITIES, example: 'high' })
  severity: FaultSeverity;

  @ApiProperty({ example: '2026-11-04T08:15:00.000+05:30', nullable: true, type: Date })
  first_seen_at: Date | null;
}

export class VehicleHealthDto {
  @ApiProperty({ example: 1 })
  device_id: number;

  @ApiProperty({
    enum: HEALTH_STATUSES,
    example: 'warning',
    description:
      'critical: a high-severity fault, coolant above 105 °C or battery below 11.5 V; warning: any other fault, coolant above 100 °C, battery below 12 V, fuel below 15% or no OBD for a day; unknown: no OBD yet',
  })
  status: HealthStatus;

  @ApiProperty({ example: ['Fault P0420: Catalyst efficiency below threshold'], type: [String] })
  reasons: string[];

  @ApiProperty({ example: '2026-11-04T08:15:00.000+05:30', nullable: true, type: Date })
  reading_at: Date | null;

  @ApiProperty({ example: 13.9, nullable: true, type: Number })
  battery_v: number | null;

  @ApiProperty({ example: 89.5, nullable: true, type: Number })
  coolant_c: number | null;

  @ApiProperty({ example: 1450, nullable: true, type: Number })
  rpm: number | null;

  @ApiProperty({ example: 63.4, nullable: true, type: Number })
  fuel_pct: number | null;

  @ApiProperty({ example: 48213.7, nullable: true, type: Number })
  odometer_km: number | null;

  @ApiProperty({ example: 42, nullable: true, type: Number })
  engine_load_pct: number | null;

  @ApiProperty({ example: 34, nullable: true, type: Number })
  speed: number | null;

  @ApiProperty({ type: [ActiveFaultDto], description: 'Active DTC codes of the latest reading (within 24 hours)' })
  faults: ActiveFaultDto[];
}

export class VehicleFaultDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 1 })
  device_id: number;

  @ApiProperty({ example: 'P0217' })
  code: string;

  @ApiProperty({ example: 'Engine coolant over temperature' })
  description: string;

  @ApiProperty({ enum: FAULT_SEVERITIES, example: 'high' })
  severity: FaultSeverity;

  @ApiProperty({ example: 48213.7, nullable: true, type: Number })
  odometer_km: number | null;

  @ApiProperty({ example: '2026-11-04T08:15:00.000+05:30' })
  first_seen_at: Date;

  @ApiProperty({ example: '2026-11-04T08:40:00.000+05:30' })
  last_seen_at: Date;

  @ApiProperty({ example: null, nullable: true, type: Date, description: 'When the code stopped being reported' })
  cleared_at: Date | null;

  @ApiProperty({ enum: DELIVERY_STATUSES, example: 'delivered', description: 'vehicle.fault webhook delivery' })
  delivery_status: DeliveryStatus;
}

export class FaultQueryDto extends TelemetryQueryDto {
  @ApiPropertyOptional({ enum: FAULT_FILTERS })
  @IsOptional()
  @IsIn(FAULT_FILTERS)
  status?: FaultFilter;
}
