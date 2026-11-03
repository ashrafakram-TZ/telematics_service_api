import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { MANUAL_END_REASONS, ManualEndReason } from '../trip-engine';

export class EndTripDto {
  @ApiProperty({ enum: MANUAL_END_REASONS, example: 'driver' })
  @IsIn(MANUAL_END_REASONS)
  reason: ManualEndReason;
}
