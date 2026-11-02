import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateDeviceDto {
  @ApiProperty({ example: '860000000000001' })
  @Matches(/^\d{15}$/, { message: 'imei must be 15 digits' })
  imei: string;

  @ApiProperty({ example: 'Truck 01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'TN01AB1234' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehicle_no?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
