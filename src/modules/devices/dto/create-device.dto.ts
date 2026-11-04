import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

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

  @ApiPropertyOptional({
    example: 40,
    nullable: true,
    type: Number,
    description: 'Overspeed limit for this vehicle in km/h; null uses SAFETY_SPEED_LIMIT_KMH',
  })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(200)
  speed_limit_kmh?: number | null;
}
