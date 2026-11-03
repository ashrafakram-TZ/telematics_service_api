import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TRIP_KINDS, TripKind } from '../trip-engine';

export const DEFAULT_APPROACH_MINUTES = 5;
export const DEFAULT_APPROACH_METRES = 800;
export const DEFAULT_STOP_RADIUS_M = 120;
export const DEFAULT_DESTINATION_RADIUS_M = 200;

export class TripDestinationInputDto {
  @ApiProperty({ example: 'Tamilzorous Model School' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 13.0878 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 80.2101 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiPropertyOptional({ example: 200, minimum: 30, maximum: 1000, default: DEFAULT_DESTINATION_RADIUS_M })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(1000)
  radius_m?: number;
}

export class TripStopInputDto {
  @ApiProperty({ example: '12', description: 'Stop reference from the product API (no personal data)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  ref: string;

  @ApiProperty({ example: 'Mogappair East bus stand' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 1000 })
  @IsInt()
  @Min(1)
  @Max(1000)
  sequence: number;

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

  @ApiPropertyOptional({ example: 120, minimum: 30, maximum: 1000, default: DEFAULT_STOP_RADIUS_M })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(1000)
  radius_m?: number;

  @ApiPropertyOptional({ example: '07:00', description: 'Planned time HH:mm, for display only' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'planned_time must be HH:mm' })
  planned_time?: string;
}

export class CreateTripDto {
  @ApiProperty({ example: 'TZMS-41', description: 'Product reference; unique among active trips' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  ref: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  device_id: number;

  @ApiProperty({
    enum: TRIP_KINDS,
    example: 'pickup',
    description:
      'pickup: stops in order, then the destination ends the trip. drop: starts at the destination, ends after the last stop.',
  })
  @IsIn(TRIP_KINDS)
  kind: TripKind;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 30, default: DEFAULT_APPROACH_MINUTES })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  approach_minutes?: number;

  @ApiPropertyOptional({ example: 800, minimum: 100, maximum: 5000, default: DEFAULT_APPROACH_METRES })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(5000)
  approach_metres?: number;

  @ApiProperty({ type: [TripStopInputDto], minItems: 1, maxItems: 60 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => TripStopInputDto)
  stops: TripStopInputDto[];

  @ApiProperty({ type: TripDestinationInputDto })
  @ValidateNested()
  @Type(() => TripDestinationInputDto)
  destination: TripDestinationInputDto;

  @ApiPropertyOptional({ example: 'Ganesan Pillai', description: 'Who started the trip, for display' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  started_by?: string;
}
