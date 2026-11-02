import { ApiProperty } from '@nestjs/swagger';

export const VEHICLE_STATES = ['moving', 'idle', 'parked', 'offline', 'no_data'] as const;
export type VehicleState = (typeof VEHICLE_STATES)[number];

export const VEHICLE_ALERTS = ['low_fuel', 'low_battery', 'harsh_driving'] as const;
export type VehicleAlert = (typeof VEHICLE_ALERTS)[number];

export class LastPositionDto {
  @ApiProperty({ example: 13.0878 })
  lat: number;

  @ApiProperty({ example: 80.2101 })
  lng: number;

  @ApiProperty({ example: 32.5, nullable: true, type: Number })
  speed: number | null;

  @ApiProperty({ example: 270, nullable: true, type: Number })
  heading: number | null;

  @ApiProperty({ example: true, nullable: true, type: Boolean })
  ignition: boolean | null;

  @ApiProperty({ example: '2026-11-02T08:15:00.000+05:30' })
  recorded_at: Date;
}

export class HarshCountsDto {
  @ApiProperty({ example: 2, description: 'Harsh braking events since midnight' })
  brake: number;

  @ApiProperty({ example: 1, description: 'Harsh acceleration events since midnight' })
  accel: number;

  @ApiProperty({ example: 0, description: 'Harsh cornering events since midnight' })
  turn: number;
}

export class DeviceStatusDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: '860000000000001' })
  imei: string;

  @ApiProperty({ example: 'Bus 01' })
  name: string;

  @ApiProperty({ example: 'TN01AB1234', nullable: true, type: String })
  vehicle_no: string | null;

  @ApiProperty({
    enum: VEHICLE_STATES,
    description: 'moving above 2 km/h; idle = stopped with the engine on; parked = engine off; offline = no signal',
  })
  state: VehicleState;

  @ApiProperty({ description: 'Reported within ONLINE_WINDOW_SECONDS' })
  online: boolean;

  @ApiProperty({ nullable: true, type: Date })
  last_seen_at: Date | null;

  @ApiProperty({ example: 64, nullable: true, type: Number, description: 'Fuel level %, last value reported' })
  fuel: number | null;

  @ApiProperty({ example: 88, nullable: true, type: Number, description: 'Vehicle battery %, last value reported' })
  battery: number | null;

  @ApiProperty({ example: 12.6, nullable: true, type: Number, description: 'Vehicle battery volts' })
  battery_voltage: number | null;

  @ApiProperty({ nullable: true, type: Date, description: 'When the vehicle last moved, while it is idle or parked' })
  stopped_since: Date | null;

  @ApiProperty({ type: HarshCountsDto })
  harsh_today: HarshCountsDto;

  @ApiProperty({ enum: VEHICLE_ALERTS, isArray: true })
  alerts: VehicleAlert[];

  @ApiProperty({ type: LastPositionDto, nullable: true })
  position: LastPositionDto | null;
}

export class FleetSummaryDto {
  @ApiProperty({ example: 4 })
  total: number;

  @ApiProperty({ example: 2 })
  moving: number;

  @ApiProperty({ example: 1, description: 'Stopped with the engine on' })
  idle: number;

  @ApiProperty({ example: 0, description: 'Engine off' })
  parked: number;

  @ApiProperty({ example: 1 })
  offline: number;

  @ApiProperty({ example: 3, description: 'Harsh braking, acceleration and cornering events today, all vehicles' })
  harsh_events_today: number;

  @ApiProperty({ example: 1 })
  low_fuel: number;

  @ApiProperty({ type: [DeviceStatusDto] })
  vehicles: DeviceStatusDto[];
}
