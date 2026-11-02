import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, FindOperator, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { AppException, offset, paginate, Paginated } from '../../common';
import { DevicesService } from '../devices/devices.service';
import { Device } from '../devices/entities/device.entity';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { TelemetryQueryDto } from './dto/telemetry-query.dto';
import { Telemetry } from './entities/telemetry.entity';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    @InjectRepository(Telemetry) private readonly telemetry: Repository<Telemetry>,
    private readonly devicesService: DevicesService,
    private readonly dataSource: DataSource,
  ) {}

  async ingest(imei: string, payload: TelemetryPayloadDto): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const device = await manager.findOneBy(Device, { imei, is_active: true });
      if (!device) {
        this.logger.warn(`Unknown imei ${imei}`);
        return;
      }

      const recordedAt = new Date(payload.ts * 1000);
      await manager.insert(Telemetry, {
        device_id: device.id,
        recorded_at: recordedAt,
        lat: payload.lat,
        lng: payload.lng,
        speed: payload.spd ?? null,
        heading: payload.hdg ?? null,
        ignition: payload.ign === undefined ? null : payload.ign === 1,
        odometer: payload.odo ?? null,
        fuel: payload.fuel ?? null,
      });
      await manager.update(Device, device.id, { last_seen_at: new Date() });
    });
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
      where: { device_id: deviceId, recorded_at: this.range(from, to) },
      order: { recorded_at: 'DESC' },
      skip: offset(page, limit),
      take: limit,
    });
    return paginate(result, page, limit);
  }

  private range(from?: string, to?: string): FindOperator<Date> | undefined {
    if (from && to) return Between(new Date(from), new Date(to));
    if (from) return MoreThanOrEqual(new Date(from));
    if (to) return LessThanOrEqual(new Date(to));
    return undefined;
  }
}
