import { ApiProperty } from '@nestjs/swagger';

export class PhonePositionResultDto {
  @ApiProperty({ example: true, description: 'false when the tracker itself sent GPS in the last 60 seconds' })
  accepted: boolean;

  @ApiProperty({ example: null, nullable: true, enum: ['device_gps_recent'], type: String })
  reason: 'device_gps_recent' | null;

  @ApiProperty({ example: 7, nullable: true, type: Number, description: 'Active trip of the device, if any' })
  trip_id: number | null;
}
