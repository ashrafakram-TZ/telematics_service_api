import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppException, offset, paginate, Paginated, timeRange } from '../../common';
import { DevicesService } from '../devices/devices.service';
import { Device } from '../devices/entities/device.entity';
import { PositionSource } from '../trips/trip-engine';
import { TripsService } from '../trips/trips.service';
import { PhonePositionResultDto } from './dto/phone-position-result.dto';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { TelemetryQueryDto } from './dto/telemetry-query.dto';
import { Telemetry } from './entities/telemetry.entity';

export const PHONE_FALLBACK_AFTER_MS = 60 * 1000;

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    @InjectRepository(Telemetry) private readonly telemetry: Repository<Telemetry>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    private readonly trips: TripsService,
    private readonly devicesService: DevicesService,
    private readonly dataSource: DataSource,
  ) {}

  async ingest(imei: string, payload: TelemetryPayloadDto): Promise<void> {
    const device = await this.devices.findOneBy({ imei, is_active: true });
    if (!device) {
      this.logger.warn(`Unknown imei ${imei}`);
      return;
    }
    await this.record(device.id, payload, 'device');
  }

  async ingestFromPhone(deviceId: number, payload: TelemetryPayloadDto): Promise<PhonePositionResultDto> {
    const device = await this.devicesService.findOne(deviceId);
    if (!device.is_active) throw AppException.conflict('Device is not active', 'DEVICE_INACTIVE');
    if (await this.deviceGpsIsFresh(device.id)) {
      return { accepted: false, reason: 'device_gps_recent', trip_id: await this.trips.activeTripId(device.id) };
    }
    const tripId = await this.record(device.id, payload, 'phone');
    return { accepted: true, reason: null, trip_id: tripId };
  }

  private async record(deviceId: number, payload: TelemetryPayloadDto, source: PositionSource): Promise<number | null> {
    const recordedAt = new Date(payload.ts * 1000);
    const tripId = await this.trips.activeTripId(deviceId);
    await this.dataSource.transaction(async (manager) => {
      await manager.insert(Telemetry, {
        device_id: deviceId,
        recorded_at: recordedAt,
        lat: payload.lat,
        lng: payload.lng,
        speed: payload.spd ?? null,
        heading: payload.hdg ?? null,
        ignition: payload.ign === undefined ? null : payload.ign === 1,
        odometer: payload.odo ?? null,
        fuel: payload.fuel ?? null,
        battery: payload.bat === undefined ? null : Math.round(payload.bat),
        battery_voltage: payload.volt ?? null,
        event: payload.evt ?? null,
        source,
        trip_id: tripId,
      });
      await manager.update(Device, deviceId, { last_seen_at: new Date() });
    });
    if (tripId) {
      void this.trips.onPosition(deviceId, {
        lat: payload.lat,
        lng: payload.lng,
        speed: payload.spd ?? null,
        heading: payload.hdg ?? null,
        recorded_at: recordedAt,
        source,
      });
    }
    return tripId;
  }

  private async deviceGpsIsFresh(deviceId: number): Promise<boolean> {
    const since = new Date(Date.now() - PHONE_FALLBACK_AFTER_MS);
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM telemetry
       WHERE device_id = $1 AND recorded_at > $2 AND (source IS NULL OR source <> 'phone')
       LIMIT 1`,
      [deviceId, since],
    );
    return rows.length > 0;
  }

  async latest(deviceId: number): Promise<Telemetry> {
    await this.devicesService.findOne(deviceId);
    const row = await this.telemetry.findOne({ where: { device_id: deviceId }, order: { recorded_at: 'DESC' } });
    if (!row) throw AppException.notFound('No position received from this device yet', 'NO_TELEMETRY');
    return row;
  }

  async history(deviceId: number, { from, to, page, limit }: TelemetryQueryDto): Promise<Paginated<Telemetry>> {
    await this.devicesService.findOne(deviceId);
    const result = await this.telemetry.findAndCount({
      where: { device_id: deviceId, recorded_at: timeRange(from, to) },
      order: { recorded_at: 'DESC' },
      skip: offset(page, limit),
      take: limit,
    });
    return paginate(result, page, limit);
  }
}
