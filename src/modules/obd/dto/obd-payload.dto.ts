import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { RecentTimestamp } from '../../telemetry/dto/telemetry-payload.dto';

export const OBD_READING_FIELDS = ['rpm', 'spd', 'coolant', 'load', 'throttle', 'fuel', 'volt', 'odo', 'dtc'] as const;
export const DTC_PATTERN = /^[PCBU][0-3][0-9A-F]{3}$/;
export const MAX_DTC_CODES = 20;

@ValidatorConstraint({ name: 'hasObdReading' })
class HasObdReading implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const payload = args.object as Record<string, unknown>;
    return OBD_READING_FIELDS.some((field) => payload[field] !== undefined && payload[field] !== null);
  }

  defaultMessage(): string {
    return `payload has no OBD reading; send at least one of ${OBD_READING_FIELDS.join(', ')}`;
  }
}

export class ObdPayloadDto {
  @Validate(HasObdReading)
  @Validate(RecentTimestamp)
  @IsInt({ message: 'ts must be Unix time in seconds (10 digits), not text or a date string' })
  ts: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000, { message: 'rpm must be between 0 and 10000' })
  rpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(255, { message: 'spd must be between 0 and 255 km/h' })
  spd?: number;

  @IsOptional()
  @IsNumber()
  @Min(-40, { message: 'coolant must be between -40 and 215 °C' })
  @Max(215, { message: 'coolant must be between -40 and 215 °C' })
  coolant?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100, { message: 'load must be a percentage between 0 and 100' })
  load?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100, { message: 'throttle must be a percentage between 0 and 100' })
  throttle?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100, { message: 'fuel must be a percentage between 0 and 100' })
  fuel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60, { message: 'volt must be between 0 and 60 V' })
  volt?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  odo?: number;

  @IsOptional()
  @Matches(DTC_PATTERN, { each: true, message: 'dtc codes must look like P0301 (P, C, B or U, then 4 hex digits)' })
  @ArrayMaxSize(MAX_DTC_CODES, { message: `dtc can list at most ${MAX_DTC_CODES} codes` })
  @IsArray({ message: 'dtc must be an array of codes like ["P0301"]' })
  dtc?: string[];
}
