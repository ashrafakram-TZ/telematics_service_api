import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationDto } from '../../../common';
import { TRIP_STATUSES, TripStatus } from '../trip-engine';

export class TripQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TRIP_STATUSES })
  @IsOptional()
  @IsIn(TRIP_STATUSES)
  status?: TripStatus;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  device_id?: number;

  @ApiPropertyOptional({ example: 'TZMS-41' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ref?: string;
}
