import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common';

export class TelemetryQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: '2026-10-29T00:00:00+05:30' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-29T23:59:59+05:30' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
