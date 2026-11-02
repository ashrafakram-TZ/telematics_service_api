import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ example: 64, nullable: true, type: Number })
  fuel: number | null;

  @ApiProperty({ example: '2026-11-02T08:15:00.000+05:30' })
  recorded_at: Date;
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

  @ApiProperty({ enum: ['moving', 'idle', 'offline', 'no_data'], example: 'moving' })
  state: 'moving' | 'idle' | 'offline' | 'no_data';

  @ApiProperty({ description: 'Reported within ONLINE_WINDOW_SECONDS' })
  online: boolean;

  @ApiProperty({ nullable: true, type: Date })
  last_seen_at: Date | null;

  @ApiProperty({ type: LastPositionDto, nullable: true })
  position: LastPositionDto | null;
}

export class FleetSummaryDto {
  @ApiProperty({ example: 4 })
  total: number;

  @ApiProperty({ example: 2 })
  moving: number;

  @ApiProperty({ example: 1 })
  idle: number;

  @ApiProperty({ example: 1 })
  offline: number;

  @ApiProperty({ type: [DeviceStatusDto] })
  vehicles: DeviceStatusDto[];
}
