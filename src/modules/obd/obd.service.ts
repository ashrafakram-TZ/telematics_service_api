import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Not, Repository } from 'typeorm';
import { AppException, offset, paginate, Paginated, timeRange } from '../../common';
import { DevicesService } from '../devices/devices.service';
import { Device } from '../devices/entities/device.entity';
import { TripWebhookService } from '../trips/trip-webhook.service';
import { ObdPayloadDto } from './dto/obd-payload.dto';
import { ObdQueryDto } from './dto/obd-query.dto';
import { FaultQueryDto, VehicleFaultDto, VehicleHealthDto } from './dto/vehicle-health.dto';
import { ObdReading } from './entities/obd-reading.entity';
import { VehicleFault } from './entities/vehicle-fault.entity';
import { clearedFaultCodes, describeDtc, DTC_STALE_HOURS, newFaultCodes, vehicleHealth } from './obd-faults';

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

export interface VehicleFaultWebhookBody {
  id: number;
  type: 'vehicle.fault';
  at: Date;
  device_id: number;
  fault: { code: string; description: string; severity: VehicleFault['severity'] };
  odometer_km?: number;
}

export function faultWebhookBody(fault: VehicleFault): VehicleFaultWebhookBody {
  return {
    id: fault.id,
    type: 'vehicle.fault',
    at: fault.first_seen_at,
    device_id: fault.device_id,
    fault: { code: fault.code, description: fault.description, severity: fault.severity },
    ...(fault.odometer_km !== null ? { odometer_km: fault.odometer_km } : {}),
  };
}

const DAY_MS = DTC_STALE_HOURS * 3600 * 1000;

@Injectable()
export class ObdService {
  private readonly logger = new Logger(ObdService.name);
  private readonly queues = new Map<number, Promise<void>>();

  constructor(
    @InjectRepository(ObdReading) private readonly readings: Repository<ObdReading>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(VehicleFault) private readonly faults: Repository<VehicleFault>,
    private readonly devicesService: DevicesService,
    private readonly webhooks: TripWebhookService,
  ) {}

  async ingest(imei: string, payload: ObdPayloadDto): Promise<void> {
    const device = await this.devices.findOneBy({ imei, is_active: true });
    if (!device) {
      this.logger.warn(`Unknown imei ${imei}`);
      return;
    }
    const row = obdRow(device.id, payload);
    await this.readings.insert(row);
    if (payload.dtc !== undefined) await this.syncFaults(device.id, row);
  }

  syncFaults(deviceId: number, row: Partial<ObdReading>): Promise<void> {
    const previous = this.queues.get(deviceId) ?? Promise.resolve();
    const next = previous
      .then(() => this.applyFaults(deviceId, row))
      .catch((error: Error) => this.logger.error(`Fault check failed for device ${deviceId}: ${error.message}`));
    this.queues.set(deviceId, next);
    void next.then(() => {
      if (this.queues.get(deviceId) === next) this.queues.delete(deviceId);
    });
    return next;
  }

  private async applyFaults(deviceId: number, row: Partial<ObdReading>): Promise<void> {
    const at = row.recorded_at!;
    const codes = row.dtc ?? [];
    const open = await this.faults.find({ where: { device_id: deviceId, cleared_at: IsNull() } });
    const openCodes = open.map((fault) => fault.code);
    const cleared = clearedFaultCodes(codes, openCodes);
    if (cleared.length) {
      await this.faults.update({ device_id: deviceId, code: In(cleared), cleared_at: IsNull() }, { cleared_at: at });
    }
    const still = codes.filter((code) => openCodes.includes(code));
    if (still.length) {
      await this.faults.update({ device_id: deviceId, code: In(still), cleared_at: IsNull() }, { last_seen_at: at });
    }
    for (const code of newFaultCodes(codes, openCodes)) {
      const info = describeDtc(code);
      const fault = await this.faults.save(
        this.faults.create({
          device_id: deviceId,
          code,
          description: info.description,
          severity: info.severity,
          odometer_km: row.odometer_km ?? null,
          first_seen_at: at,
          last_seen_at: at,
          cleared_at: null,
          delivery_status: this.webhooks.enabled ? 'pending' : 'off',
        }),
      );
      this.logger.warn(`Device ${deviceId} new fault ${code} (${info.description})`);
      this.webhooks.send(`device ${deviceId}`, faultWebhookBody(fault), (update) =>
        this.faults.update(fault.id, update),
      );
    }
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

  async health(deviceId: number, now = new Date()): Promise<VehicleHealthDto> {
    await this.devicesService.findOne(deviceId);
    const reading = await this.readings.findOne({ where: { device_id: deviceId }, order: { recorded_at: 'DESC' } });
    const verdict = vehicleHealth(
      reading
        ? {
            at: reading.recorded_at,
            battery_v: reading.battery_v,
            coolant_c: reading.coolant_c,
            fuel_pct: reading.fuel_pct,
            dtc: reading.dtc,
          }
        : null,
      now,
    );
    const fresh = reading !== null && now.getTime() - reading.recorded_at.getTime() <= DAY_MS;
    const codes = fresh ? [...new Set(reading.dtc)] : [];
    const open = codes.length
      ? await this.faults.find({ where: { device_id: deviceId, code: In(codes), cleared_at: IsNull() } })
      : [];
    return {
      device_id: deviceId,
      status: verdict.status,
      reasons: verdict.reasons,
      reading_at: reading?.recorded_at ?? null,
      battery_v: reading?.battery_v ?? null,
      coolant_c: reading?.coolant_c ?? null,
      rpm: reading?.rpm ?? null,
      fuel_pct: reading?.fuel_pct ?? null,
      odometer_km: reading?.odometer_km ?? null,
      engine_load_pct: reading?.engine_load_pct ?? null,
      speed: reading?.speed ?? null,
      faults: codes.map((code) => ({
        code,
        ...describeDtc(code),
        first_seen_at: open.find((fault) => fault.code === code)?.first_seen_at ?? null,
      })),
    };
  }

  async faultLog(deviceId: number, query: FaultQueryDto): Promise<Paginated<VehicleFaultDto>> {
    await this.devicesService.findOne(deviceId);
    const where: FindOptionsWhere<VehicleFault> = {
      device_id: deviceId,
      first_seen_at: timeRange(query.from, query.to),
    };
    if (query.status === 'open') where.cleared_at = IsNull();
    if (query.status === 'cleared') where.cleared_at = Not(IsNull());
    const [rows, total] = await this.faults.findAndCount({
      where,
      order: { first_seen_at: 'DESC', id: 'DESC' },
      skip: offset(query.page, query.limit),
      take: query.limit,
    });
    const items: VehicleFaultDto[] = rows.map((row) => ({
      id: row.id,
      device_id: row.device_id,
      code: row.code,
      description: row.description,
      severity: row.severity,
      odometer_km: row.odometer_km,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      cleared_at: row.cleared_at,
      delivery_status: row.delivery_status,
    }));
    return paginate([items, total], query.page, query.limit);
  }
}
