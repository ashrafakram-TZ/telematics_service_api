import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SafetyEvent } from '../safety/entities/safety-event.entity';
import { tripPath } from '../safety/safety-rules';
import { toSafetyEventDto } from '../safety/safety-view';
import { Telemetry } from '../telemetry/entities/telemetry.entity';
import { TripPlaybackDto } from './dto/trip-playback.dto';
import { downsample, TrackPoint, trackStats } from './trip-playback';
import { TripsService } from './trips.service';

@Injectable()
export class TripPlaybackService {
  constructor(
    @InjectRepository(Telemetry) private readonly telemetry: Repository<Telemetry>,
    @InjectRepository(SafetyEvent) private readonly safety: Repository<SafetyEvent>,
    private readonly trips: TripsService,
  ) {}

  async playback(id: number, maxPoints: number): Promise<TripPlaybackDto> {
    const trip = await this.trips.findOne(id);
    const [rows, events] = await Promise.all([
      this.telemetry.find({
        where: { trip_id: id },
        select: { id: true, recorded_at: true, lat: true, lng: true, speed: true, heading: true },
        order: { recorded_at: 'ASC', id: 'ASC' },
      }),
      this.safety.find({ where: { trip_id: id }, order: { occurred_at: 'ASC', id: 'ASC' } }),
    ]);
    const track: TrackPoint[] = rows.map((row) => ({
      at: row.recorded_at,
      lat: row.lat,
      lng: row.lng,
      speed: row.speed,
      heading: row.heading,
    }));
    const points = downsample(track, maxPoints);
    return {
      trip,
      path: tripPath(trip.kind, trip.stops, trip.destination),
      points,
      total_points: track.length,
      sampled: points.length < track.length,
      ...trackStats(track),
      stop_arrivals: trip.stops.map((stop) => ({
        ref: stop.ref,
        name: stop.name,
        sequence: stop.sequence,
        status: stop.status,
        planned_time: stop.planned_time,
        arrived_at: stop.arrived_at,
        departed_at: stop.departed_at,
        lat: stop.lat,
        lng: stop.lng,
      })),
      safety_events: events.map(toSafetyEventDto),
    };
  }
}
