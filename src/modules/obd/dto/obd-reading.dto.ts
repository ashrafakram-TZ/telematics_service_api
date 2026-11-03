import { ApiProperty } from '@nestjs/swagger';

export class ObdReadingDto {
  @ApiProperty({ example: '1024', description: 'bigint, sent as a string' })
  id: string;

  @ApiProperty({ example: 1 })
  device_id: number;

  @ApiProperty({ example: '2026-11-03T08:15:00.000+05:30' })
  recorded_at: Date;

  @ApiProperty({ example: 1450, nullable: true, type: Number })
  rpm: number | null;

  @ApiProperty({ example: 34, nullable: true, type: Number, description: 'Vehicle speed from the ECU, km/h' })
  speed: number | null;

  @ApiProperty({ example: 89.5, nullable: true, type: Number, description: 'Engine coolant temperature in °C' })
  coolant_c: number | null;

  @ApiProperty({ example: 42, nullable: true, type: Number, description: 'Calculated engine load %' })
  engine_load_pct: number | null;

  @ApiProperty({ example: 18, nullable: true, type: Number, description: 'Throttle position %' })
  throttle_pct: number | null;

  @ApiProperty({ example: 63.4, nullable: true, type: Number, description: 'Fuel tank level %' })
  fuel_pct: number | null;

  @ApiProperty({ example: 13.9, nullable: true, type: Number, description: 'Battery or charging voltage' })
  battery_v: number | null;

  @ApiProperty({ example: 48213.7, nullable: true, type: Number, description: 'ECU odometer km' })
  odometer_km: number | null;

  @ApiProperty({ example: ['P0301'], type: [String], description: 'Active diagnostic trouble codes, empty when none' })
  dtc: string[];

  @ApiProperty({ example: '2026-11-03T08:15:01.000+05:30' })
  received_at: Date;
}
