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

@ValidatorConstraint({ name: 'recentTimestamp' })
class RecentTimestamp implements ValidatorConstraintInterface {
  validate(ts: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    return ts >= now - MAX_PAST_SECONDS && ts <= now + MAX_FUTURE_SECONDS;
  }

  defaultMessage(): string {
    return 'ts must be current Unix time in seconds (10 digits), within the last 30 days and at most 5 minutes ahead';
  }
}

export class TelemetryPayloadDto {
  @Validate(RecentTimestamp)
  @IsInt({ message: 'ts must be Unix time in seconds (10 digits), not text or a date string' })
  ts: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  spd?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(359)
  hdg?: number;

  @IsOptional()
  @IsIn([0, 1])
  ign?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  odo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  fuel?: number;
}
