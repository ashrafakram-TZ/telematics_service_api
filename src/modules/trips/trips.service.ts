import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { AppException, offset, paginate, Paginated } from '../../common';
import { DevicesService } from '../devices/devices.service';
import { Telemetry } from '../telemetry/entities/telemetry.entity';
import {
  CreateTripDto,
  DEFAULT_APPROACH_METRES,
  DEFAULT_APPROACH_MINUTES,
  DEFAULT_DESTINATION_RADIUS_M,
  DEFAULT_STOP_RADIUS_M,
} from './dto/create-trip.dto';
import { TripQueryDto } from './dto/trip-query.dto';
import { TripStateDto } from './dto/trip-state.dto';
import { TripEvent } from './entities/trip-event.entity';
import { TripStop } from './entities/trip-stop.entity';
import { Trip } from './entities/trip.entity';
import {
  advanceTrip,
  closeStops,
  EndReason,
  EnginePoint,
  etaSpeedKmph,
  PositionSource,
  recentSpeeds,
  SpeedSample,
  StopEvent,
} from './trip-engine';
import { engineView, toTripState, TripWebhookBody, WebhookEventInput, webhookBody } from './trip-view';
import { TripWebhookService } from './trip-webhook.service';

export interface TripPoint extends EnginePoint {
  speed: number | null;
  heading: number | null;
  source: PositionSource;
}

const HOUR_MS = 60 * 60 * 1000;
export const NO_GPS_TIMEOUT_MS = 4 * HOUR_MS;
export const MAX_TRIP_MS = 6 * HOUR_MS;
const SWEEP_EVERY_MS = 60 * 1000;
const INITIAL_POSITION_MAX_AGE_MS = 5 * 60 * 1000;

@Injectable()
export class TripsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TripsService.name);
  private readonly active = new Map<number, Trip | null>();
  private readonly speeds = new Map<number, SpeedSample[]>();
  private readonly queues = new Map<number, Promise<void>>();
  private sweeper?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
    @InjectRepository(Telemetry) private readonly telemetry: Repository<Telemetry>,
    private readonly devicesService: DevicesService,
    private readonly dataSource: DataSource,
    private readonly webhooks: TripWebhookService,
  ) {}

  onApplicationBootstrap(): void {
    this.sweeper = setInterval(() => {
      this.sweepTimeouts().catch((error: Error) => this.logger.error(`Timeout sweep failed: ${error.message}`));
    }, SWEEP_EVERY_MS);
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  async create(dto: CreateTripDto): Promise<TripStateDto> {
    const device = await this.devicesService.findOne(dto.device_id);
    this.assertStops(dto);
    return this.serial(device.id, async () => {
      if (await this.activeTrip(device.id)) {
        throw AppException.conflict('This device already has an active trip', 'TRIP_ALREADY_ACTIVE');
      }
      if (await this.trips.exists({ where: { ref: dto.ref, status: 'active' } })) {
        throw AppException.conflict(`An active trip already uses ref ${dto.ref}`, 'TRIP_REF_ACTIVE');
      }
      const latest = await this.telemetry.findOne({ where: { device_id: device.id }, order: { recorded_at: 'DESC' } });
      const now = new Date();
      const fresh =
        latest && now.getTime() - latest.recorded_at.getTime() <= INITIAL_POSITION_MAX_AGE_MS ? latest : null;
      const stops = [...dto.stops].sort((a, b) => a.sequence - b.sequence);

      const { trip, bodies } = await this.dataSource.transaction(async (manager) => {
        const saved = await manager.save(
          manager.create(Trip, {
            ref: dto.ref,
            device_id: device.id,
            kind: dto.kind,
            status: 'active',
            approach_minutes: dto.approach_minutes ?? DEFAULT_APPROACH_MINUTES,
            approach_metres: dto.approach_metres ?? DEFAULT_APPROACH_METRES,
            destination_name: dto.destination.name,
            destination_lat: dto.destination.lat,
            destination_lng: dto.destination.lng,
            destination_radius_m: dto.destination.radius_m ?? DEFAULT_DESTINATION_RADIUS_M,
            started_by: dto.started_by ?? null,
            started_at: now,
            ended_at: null,
            end_reason: null,
            position_lat: fresh?.lat ?? null,
            position_lng: fresh?.lng ?? null,
            position_speed: fresh?.speed ?? null,
            position_heading: fresh?.heading ?? null,
            position_at: fresh?.recorded_at ?? null,
            position_source: fresh ? (fresh.source ?? 'device') : null,
            next_stop_ref: stops[0].ref,
            destination_eta_seconds: null,
            stops: stops.map((stop) =>
              manager.create(TripStop, {
                ref: stop.ref,
                name: stop.name,
                sequence: stop.sequence,
                lat: stop.lat,
                lng: stop.lng,
                radius_m: stop.radius_m ?? DEFAULT_STOP_RADIUS_M,
                planned_time: stop.planned_time ?? null,
                status: 'pending',
                eta_seconds: null,
                distance_m: null,
                approached_at: null,
                arrived_at: null,
                departed_at: null,
              }),
            ),
          }),
        );
        saved.stops.sort((a, b) => a.sequence - b.sequence);
        return { trip: saved, bodies: await this.storeEvents(manager, saved, [{ type: 'trip.started', at: now }]) };
      });

      this.active.set(device.id, trip);
      bodies.forEach((body) => this.webhooks.enqueue(body));
      this.logger.log(`Trip ${trip.id} (${trip.ref}) started on device ${device.id}`);
      return toTripState(trip);
    });
  }

  async end(id: number, reason: EndReason): Promise<TripStateDto> {
    const found = await this.trips.findOne({ where: { id }, select: { id: true, device_id: true } });
    if (!found) throw AppException.notFound('Trip not found', 'TRIP_NOT_FOUND');
    return this.serial(found.device_id, async () => {
      const trip = await this.current(found.device_id, id);
      if (trip.status === 'active') await this.finish(trip, reason, new Date());
      return toTripState(trip);
    });
  }

  async findOne(id: number): Promise<TripStateDto> {
    return toTripState(await this.load(id));
  }

  async list(query: TripQueryDto): Promise<Paginated<TripStateDto>> {
    const where: FindOptionsWhere<Trip> = {};
    if (query.status) where.status = query.status;
    if (query.device_id) where.device_id = query.device_id;
    if (query.ref) where.ref = query.ref;
    const [items, total] = await this.trips.findAndCount({
      where,
      relations: { stops: true },
      order: { started_at: 'DESC', id: 'DESC', stops: { sequence: 'ASC' } },
      skip: offset(query.page, query.limit),
      take: query.limit,
    });
    return paginate([items.map(toTripState), total], query.page, query.limit);
  }

  async activeTripId(deviceId: number): Promise<number | null> {
    return (await this.activeTrip(deviceId))?.id ?? null;
  }

  onPosition(deviceId: number, point: TripPoint): Promise<void> {
    return this.serial(deviceId, () => this.advance(deviceId, point)).catch((error: Error) => {
      this.active.delete(deviceId);
      this.logger.error(`Trip engine failed for device ${deviceId}: ${error.message}`, error.stack);
    });
  }

  async sweepTimeouts(now = new Date()): Promise<number> {
    const stale = await this.trips
      .createQueryBuilder('t')
      .select(['t.id', 't.device_id'])
      .where(`t.status = 'active'`)
      .andWhere('(t.started_at < :maxStart OR COALESCE(t.position_at, t.started_at) < :quietSince)', {
        maxStart: new Date(now.getTime() - MAX_TRIP_MS),
        quietSince: new Date(now.getTime() - NO_GPS_TIMEOUT_MS),
      })
      .getMany();
    for (const row of stale) {
      await this.serial(row.device_id, async () => {
        const trip = await this.current(row.device_id, row.id);
        if (trip.status === 'active') await this.finish(trip, 'timeout', now);
      });
    }
    return stale.length;
  }

  private async advance(deviceId: number, point: TripPoint): Promise<void> {
    const trip = await this.activeTrip(deviceId);
    if (!trip) return;
    if (trip.position_at && point.recorded_at.getTime() < trip.position_at.getTime()) return;

    const at = point.recorded_at.getTime();
    const samples = recentSpeeds([...(this.speeds.get(trip.id) ?? []), { at, speed: point.speed ?? 0 }], at);
    this.speeds.set(trip.id, samples);
    const result = advanceTrip(engineView(trip), point, etaSpeedKmph(samples.map((sample) => sample.speed)));

    trip.position_lat = point.lat;
    trip.position_lng = point.lng;
    trip.position_speed = point.speed;
    trip.position_heading = point.heading;
    trip.position_at = point.recorded_at;
    trip.position_source = point.source;
    trip.destination_eta_seconds = result.destination_eta_seconds;
    trip.next_stop_ref = trip.stops.find((stop) => stop.id === result.next_stop_id)?.ref ?? null;

    const bodies = await this.persist(trip, result.events, result.end_reason, point.recorded_at);
    const nextStop = trip.stops.find((stop) => stop.id === result.next_stop_id);
    this.webhooks.position(
      webhookBody(0, trip, {
        type: 'trip.position',
        at: point.recorded_at,
        eta_seconds: nextStop ? nextStop.eta_seconds : trip.destination_eta_seconds,
      }),
    );
    bodies.forEach((body) => this.webhooks.enqueue(body));
    if (result.end_reason) this.release(trip);
  }

  private async finish(trip: Trip, reason: EndReason, at: Date): Promise<void> {
    const events = closeStops(engineView(trip), at);
    trip.destination_eta_seconds = null;
    const bodies = await this.persist(trip, events, reason, at);
    bodies.forEach((body) => this.webhooks.enqueue(body));
    this.release(trip);
  }

  private async persist(
    trip: Trip,
    events: StopEvent[],
    endReason: EndReason | null,
    at: Date,
  ): Promise<TripWebhookBody[]> {
    if (endReason) {
      trip.status = 'ended';
      trip.ended_at = at;
      trip.end_reason = endReason;
      trip.next_stop_ref = null;
      this.logger.log(`Trip ${trip.id} (${trip.ref}) ended: ${endReason}`);
    }
    const inputs: WebhookEventInput[] = events.map((event) => ({
      type: event.type,
      at,
      stop: trip.stops.find((stop) => stop.id === event.stop_id) ?? null,
      eta_seconds: event.eta_seconds,
    }));
    if (endReason) inputs.push({ type: 'trip.ended', at, end_reason: endReason });

    return this.dataSource.transaction(async (manager) => {
      await manager.update(Trip, trip.id, {
        status: trip.status,
        ended_at: trip.ended_at,
        end_reason: trip.end_reason,
        position_lat: trip.position_lat,
        position_lng: trip.position_lng,
        position_speed: trip.position_speed,
        position_heading: trip.position_heading,
        position_at: trip.position_at,
        position_source: trip.position_source,
        next_stop_ref: trip.next_stop_ref,
        destination_eta_seconds: trip.destination_eta_seconds,
      });
      await manager.query(
        `UPDATE trip_stops AS s
         SET status = v.status, eta_seconds = v.eta_seconds, distance_m = v.distance_m,
             approached_at = v.approached_at, arrived_at = v.arrived_at, departed_at = v.departed_at
         FROM jsonb_to_recordset($1::jsonb) AS v(id int, status varchar, eta_seconds int, distance_m int,
              approached_at timestamptz, arrived_at timestamptz, departed_at timestamptz)
         WHERE s.id = v.id AND s.trip_id = $2`,
        [
          JSON.stringify(
            trip.stops.map((stop) => ({
              id: stop.id,
              status: stop.status,
              eta_seconds: stop.eta_seconds,
              distance_m: stop.distance_m,
              approached_at: stop.approached_at,
              arrived_at: stop.arrived_at,
              departed_at: stop.departed_at,
            })),
          ),
          trip.id,
        ],
      );
      return this.storeEvents(manager, trip, inputs);
    });
  }

  private async storeEvents(
    manager: EntityManager,
    trip: Trip,
    inputs: WebhookEventInput[],
  ): Promise<TripWebhookBody[]> {
    if (!inputs.length) return [];
    const bodies = inputs.map((input) => webhookBody(0, trip, input));
    const result = await manager.insert(
      TripEvent,
      inputs.map((input, index) => {
        const payload = Object.fromEntries(Object.entries(bodies[index]).filter(([key]) => key !== 'id'));
        return manager.create(TripEvent, {
          trip_id: trip.id,
          type: input.type,
          stop_id: input.stop?.id ?? null,
          occurred_at: input.at,
          payload,
          delivery_status: this.webhooks.enabled ? 'pending' : 'off',
        });
      }),
    );
    return bodies.map((body, index) => ({ ...body, id: Number(result.identifiers[index].id) }));
  }

  private release(trip: Trip): void {
    this.active.set(trip.device_id, null);
    this.speeds.delete(trip.id);
    this.webhooks.forgetTrip(trip.id);
  }

  private async activeTrip(deviceId: number): Promise<Trip | null> {
    if (this.active.has(deviceId)) return this.active.get(deviceId) ?? null;
    const trip = await this.trips.findOne({
      where: { device_id: deviceId, status: 'active' },
      relations: { stops: true },
      order: { stops: { sequence: 'ASC' } },
    });
    if (!this.active.has(deviceId)) this.active.set(deviceId, trip);
    return this.active.get(deviceId) ?? null;
  }

  private async current(deviceId: number, id: number): Promise<Trip> {
    const cached = this.active.get(deviceId);
    return cached?.id === id ? cached : this.load(id);
  }

  private async load(id: number): Promise<Trip> {
    const trip = await this.trips.findOne({
      where: { id },
      relations: { stops: true },
      order: { stops: { sequence: 'ASC' } },
    });
    if (!trip) throw AppException.notFound('Trip not found', 'TRIP_NOT_FOUND');
    return trip;
  }

  private assertStops(dto: CreateTripDto): void {
    const sequences = new Set<number>();
    const refs = new Set<string>();
    for (const stop of dto.stops) {
      if (sequences.has(stop.sequence)) {
        throw AppException.badRequest(`Stop sequence ${stop.sequence} is used twice`, 'DUPLICATE_STOP_SEQUENCE');
      }
      if (refs.has(stop.ref)) throw AppException.badRequest(`Stop ref ${stop.ref} is used twice`, 'DUPLICATE_STOP_REF');
      sequences.add(stop.sequence);
      refs.add(stop.ref);
    }
  }

  private serial<T>(deviceId: number, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(deviceId) ?? Promise.resolve();
    const result = previous.then(task);
    const settled = result.then(
      () => undefined,
      () => undefined,
    );
    this.queues.set(deviceId, settled);
    void settled.then(() => {
      if (this.queues.get(deviceId) === settled) this.queues.delete(deviceId);
    });
    return result;
  }
}
