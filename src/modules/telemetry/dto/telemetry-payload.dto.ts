import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const MAX_PAST_SECONDS = 30 * 24 * 60 * 60;
const MAX_FUTURE_SECONDS = 5 * 60;

export const DRIVING_EVENTS = ['harsh_brake', 'harsh_accel', 'harsh_turn'] as const;
export type DrivingEvent = (typeof DRIVING_EVENTS)[number];

@ValidatorConstraint({ name: 'recentTimestamp' })
export class RecentTimestamp implements ValidatorConstraintInterface {
  validate(ts: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    return ts >= now - MAX_PAST_SECONDS && ts <= now + MAX_FUTURE_SECONDS;
  }

  defaultMessage(): string {
    return 'ts must be current Unix time in seconds (10 digits), within the last 30 days and at most 5 minutes ahead';
  }
}

export class TelemetryPayloadDto {
  @ApiProperty({ example: 1793600000, description: 'Unix time in seconds' })
  @Validate(RecentTimestamp)
  @IsInt({ message: 'ts must be Unix time in seconds (10 digits), not text or a date string' })
  ts: number;

  @ApiProperty({ example: 13.0846 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 80.1767 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiPropertyOptional({ example: 28, description: 'Speed km/h' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  spd?: number;

  @ApiPropertyOptional({ example: 90, minimum: 0, maximum: 359 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(359)
  hdg?: number;

  @ApiPropertyOptional({ example: 1, enum: [0, 1] })
  @IsOptional()
  @IsIn([0, 1])
  ign?: number;

  @ApiPropertyOptional({ example: 12045.2, description: 'Odometer km' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  odo?: number;

  @ApiPropertyOptional({ example: 64, description: 'Fuel %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  fuel?: number;

  @ApiPropertyOptional({ example: 88, description: 'Battery %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  bat?: number;

  @ApiPropertyOptional({ example: 12.6, description: 'Battery volts' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  volt?: number;

  @ApiPropertyOptional({ enum: DRIVING_EVENTS, example: 'harsh_brake' })
  @IsOptional()
  @IsIn(DRIVING_EVENTS, { message: `evt must be one of ${DRIVING_EVENTS.join(', ')}` })
  evt?: DrivingEvent;
}
