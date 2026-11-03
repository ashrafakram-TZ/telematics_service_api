import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException, offset, paginate, Paginated, timeRange } from '../../common';
import { DevicesService } from '../devices/devices.service';
import { Device } from '../devices/entities/device.entity';
import { ObdPayloadDto } from './dto/obd-payload.dto';
import { ObdQueryDto } from './dto/obd-query.dto';
import { ObdReading } from './entities/obd-reading.entity';

export function obdRow(deviceId: number, payload: ObdPayloadDto): Partial<ObdReading> {
  return {
    device_id: deviceId,
    recorded_at: new Date(payload.ts * 1000),
    rpm: payload.rpm === undefined ? null : Math.round(payload.rpm),
    speed: payload.spd ?? null,
    coolant_c: payload.coolant ?? null,
    engine_load_pct: payload.load ?? null,
    throttle_pct: payload.throttle ?? null,
    fuel_pct: payload.fuel ?? null,
    battery_v: payload.volt ?? null,
    odometer_km: payload.odo ?? null,
    dtc: [...new Set(payload.dtc ?? [])],
  };
}

@Injectable()
export class ObdService {
  private readonly logger = new Logger(ObdService.name);

  constructor(
    @InjectRepository(ObdReading) private readonly readings: Repository<ObdReading>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    private readonly devicesService: DevicesService,
  ) {}

  async ingest(imei: string, payload: ObdPayloadDto): Promise<void> {
    const device = await this.devices.findOneBy({ imei, is_active: true });
    if (!device) {
      this.logger.warn(`Unknown imei ${imei}`);
      return;
    }
    await this.readings.insert(obdRow(device.id, payload));
  }

  async latest(deviceId: number): Promise<ObdReading> {
    await this.devicesService.findOne(deviceId);
    const row = await this.readings.findOne({ where: { device_id: deviceId }, order: { recorded_at: 'DESC' } });
    if (!row) throw AppException.notFound('No OBD data received from this device yet', 'NO_OBD_DATA');
    return row;
  }

  async history(deviceId: number, { from, to, page, limit }: ObdQueryDto): Promise<Paginated<ObdReading>> {
    await this.devicesService.findOne(deviceId);
    const result = await this.readings.findAndCount({
      where: { device_id: deviceId, recorded_at: timeRange(from, to) },
      order: { recorded_at: 'DESC' },
      skip: offset(page, limit),
      take: limit,
    });
    return paginate(result, page, limit);
  }
}
