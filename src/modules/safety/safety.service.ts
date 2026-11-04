import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { offset, paginate, Paginated, timeRange } from '../../common';
import { safetyConfig, SafetyConfig } from '../../config/safety.config';
import { Device } from '../devices/entities/device.entity';
import { SafetyTripContext, TripsService } from '../trips/trips.service';
import { TripWebhookService } from '../trips/trip-webhook.service';
import { SafetyEventDto, SafetyQueryDto } from './dto/safety-event.dto';
import { SafetyEvent } from './entities/safety-event.entity';
import { alertBody, toSafetyEventDto } from './safety-view';
import {
  evaluateSafety,
  newSafetyState,
  SafetyFinding,
  SafetyPoint,
  SafetySettings,
  SafetyState,
} from './safety-rules';

const LIMIT_CACHE_MS = 60 * 1000;

@Injectable()
export class SafetyService {
  private readonly logger = new Logger('Safety');
  private readonly states = new Map<number, SafetyState>();
  private readonly limits = new Map<number, { limit: number | null; at: number }>();
  private readonly queues = new Map<number, Promise<void>>();

  constructor(
    @InjectRepository(SafetyEvent) private readonly events: Repository<SafetyEvent>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    private readonly trips: TripsService,
    private readonly webhooks: TripWebhookService,
    @Inject(safetyConfig.KEY) private readonly config: SafetyConfig,
  ) {}

  onPosition(deviceId: number, point: SafetyPoint): Promise<void> {
    const previous = this.queues.get(deviceId) ?? Promise.resolve();
    const next = previous
      .then(() => this.check(deviceId, point))
      .catch((error: Error) => this.logger.error(`Safety check failed for device ${deviceId}: ${error.message}`));
    this.queues.set(deviceId, next);
    void next.then(() => {
      if (this.queues.get(deviceId) === next) this.queues.delete(deviceId);
    });
    return next;
  }

  settings(deviceLimit: number | null): SafetySettings {
    return {
      speed_limit_kmh: deviceLimit ?? this.config.speedLimitKmh,
      overspeed_seconds: this.config.overspeedSeconds,
      harsh_brake_kmh_per_s: this.config.harshBrakeKmhPerS,
      idle_minutes: this.config.idleMinutes,
      deviation_m: this.config.deviationMetres,
      deviation_seconds: this.config.deviationSeconds,
      cooldown_seconds: this.config.cooldownSeconds,
    };
  }

  async list(query: SafetyQueryDto): Promise<Paginated<SafetyEventDto>> {
    const where: FindOptionsWhere<SafetyEvent> = { occurred_at: timeRange(query.from, query.to) };
    if (query.device_id) where.device_id = query.device_id;
    if (query.trip_id) where.trip_id = query.trip_id;
    if (query.kind) where.kind = query.kind;
    if (query.severity) where.severity = query.severity;
    const [rows, total] = await this.events.findAndCount({
      where,
      order: { occurred_at: 'DESC', id: 'DESC' },
      skip: offset(query.page, query.limit),
      take: query.limit,
    });
    return paginate([rows.map(toSafetyEventDto), total], query.page, query.limit);
  }

  private async check(deviceId: number, point: SafetyPoint): Promise<void> {
    const [trip, limit] = await Promise.all([this.trips.safetyContext(deviceId), this.speedLimit(deviceId)]);
    let state = this.states.get(deviceId);
    if (!state) {
      state = newSafetyState();
      this.states.set(deviceId, state);
    }
    const findings = evaluateSafety(state, point, this.settings(limit), trip);
    for (const item of findings) await this.raise(deviceId, trip, item);
  }

  private async raise(deviceId: number, trip: SafetyTripContext | null, item: SafetyFinding): Promise<void> {
    const saved = await this.events.save(
      this.events.create({
        device_id: deviceId,
        trip_id: trip?.id ?? null,
        kind: item.kind,
        severity: item.severity,
        message: item.message.slice(0, 200),
        value: item.value,
        limit_value: item.limit,
        lat: item.position.lat,
        lng: item.position.lng,
        speed: item.position.speed_kmh,
        occurred_at: item.at,
        delivery_status: this.webhooks.enabled ? 'pending' : 'off',
      }),
    );
    this.logger.warn(`Device ${deviceId}: ${item.message}`);
    this.webhooks.send(`device ${deviceId}`, alertBody(saved.id, deviceId, trip, item), (update) =>
      this.events.update(saved.id, update),
    );
  }

  private async speedLimit(deviceId: number): Promise<number | null> {
    const cached = this.limits.get(deviceId);
    if (cached && Date.now() - cached.at < LIMIT_CACHE_MS) return cached.limit;
    const device = await this.devices.findOne({ where: { id: deviceId }, select: { id: true, speed_limit_kmh: true } });
    const limit = device?.speed_limit_kmh ?? null;
    this.limits.set(deviceId, { limit, at: Date.now() });
    return limit;
  }
}
