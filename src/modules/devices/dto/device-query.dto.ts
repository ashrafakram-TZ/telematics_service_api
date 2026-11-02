import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListQueryDto } from '../../../common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class DeviceQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by active flag' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  is_active?: boolean;
}
