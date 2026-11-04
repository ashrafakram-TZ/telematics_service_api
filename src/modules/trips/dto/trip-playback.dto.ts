import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { SafetyEventDto } from '../../safety/dto/safety-event.dto';
import { STOP_STATUSES, StopStatus } from '../trip-engine';
import { DEFAULT_PLAYBACK_POINTS, MAX_PLAYBACK_POINTS } from '../trip-playback';
import { TripStateDto } from './trip-state.dto';

export class PlaybackQueryDto {
  @ApiPropertyOptional({ default: DEFAULT_PLAYBACK_POINTS, minimum: 50, maximum: MAX_PLAYBACK_POINTS })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(MAX_PLAYBACK_POINTS)
  max_points: number = DEFAULT_PLAYBACK_POINTS;
}

export class PlaybackPointDto {
  @ApiProperty({ example: '2026-11-09T07:12:30.000+05:30' })
  at: Date;

  @ApiProperty({ example: 13.0849 })
  lat: number;

  @ApiProperty({ example: 80.2105 })
  lng: number;

  @ApiProperty({ example: 28, nullable: true, type: Number, description: 'km/h' })
  speed: number | null;

  @ApiProperty({ example: 90, nullable: true, type: Number })
  heading: number | null;
}

export class PathPointDto {
  @ApiProperty({ example: 13.0846 })
  lat: number;

  @ApiProperty({ example: 80.1767 })
  lng: number;
}

export class StopArrivalDto {
  @ApiProperty({ example: '12' })
  ref: string;

  @ApiProperty({ example: 'Mogappair East bus stand' })
  name: string;

  @ApiProperty({ example: 1 })
  sequence: number;

  @ApiProperty({ enum: STOP_STATUSES, example: 'departed' })
  status: StopStatus;

  @ApiProperty({ example: '07:00', nullable: true, type: String })
  planned_time: string | null;

  @ApiProperty({ example: '2026-11-09T07:01:10.000+05:30', nullable: true, type: Date })
  arrived_at: Date | null;

  @ApiProperty({ example: '2026-11-09T07:01:45.000+05:30', nullable: true, type: Date })
  departed_at: Date | null;

  @ApiProperty({ example: 13.0846 })
  lat: number;

  @ApiProperty({ example: 80.1767 })
  lng: number;
}

export class TripPlaybackDto {
  @ApiProperty({ type: TripStateDto })
  trip: TripStateDto;

  @ApiProperty({ type: [PathPointDto], description: 'Planned path: stops in travel order and the destination' })
  path: PathPointDto[];

  @ApiProperty({ type: [PlaybackPointDto], description: 'GPS track of the trip, oldest first' })
  points: PlaybackPointDto[];

  @ApiProperty({ example: 1840, description: 'Points stored for the trip before downsampling' })
  total_points: number;

  @ApiProperty({ example: true, description: 'True when points were thinned to max_points (first and last kept)' })
  sampled: boolean;

  @ApiProperty({ example: 12.4, description: 'Driven distance over every stored point' })
  distance_km: number;

  @ApiProperty({ example: 3120 })
  duration_seconds: number;

  @ApiProperty({ example: 54, nullable: true, type: Number })
  max_speed: number | null;

  @ApiProperty({ example: 23.1, nullable: true, type: Number, description: 'distance / duration, km/h' })
  avg_speed: number | null;

  @ApiProperty({ type: [StopArrivalDto] })
  stop_arrivals: StopArrivalDto[];

  @ApiProperty({ type: [SafetyEventDto], description: 'Safety events raised during the trip, oldest first' })
  safety_events: SafetyEventDto[];
}
