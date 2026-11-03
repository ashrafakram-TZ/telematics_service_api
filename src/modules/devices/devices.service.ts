import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppException, listQuery, Paginated } from '../../common';
import { appConfig, AppConfig } from '../../config/configuration';
import { obdAlerts } from '../obd/obd-faults';
import { deviceState, MOVING_KMPH, vehicleAlerts } from './device-state';
import { DeviceStatusDto, FleetSummaryDto, ObdSnapshotDto } from './dto/device-status.dto';
import { Device } from './entities/device.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { DeviceQueryDto } from './dto/device-query.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    private readonly dataSource: DataSource,
    @Inject(appConfig.KEY) private readonly app: AppConfig,
  ) {}

  async live(): Promise<FleetSummaryDto> {
    const rows: (Device & {
      lat: number | null;
      lng: number | null;
      speed: number | null;
      heading: number | null;
      ignition: boolean | null;
      recorded_at: Date | null;
      fuel: number | null;
      battery: number | null;
      battery_voltage: number | null;
      last_moved_at: Date | null;
      harsh_brake: string;
      harsh_accel: string;
      harsh_turn: string;
      obd_at: Date | null;
      rpm: number | null;
      obd_speed: number | null;
      coolant_c: number | null;
      engine_load_pct: number | null;
      throttle_pct: number | null;
      fuel_pct: number | null;
      battery_v: number | null;
      odometer_km: number | null;
      dtc: string[] | null;
    })[] = await this.dataSource.query(
      `SELECT d.id, d.imei, d.name, d.vehicle_no, d.last_seen_at,
              t.lat, t.lng, t.speed, t.heading, t.ignition, t.recorded_at,
              f.fuel, b.battery, b.battery_voltage, m.last_moved_at,
              COALESCE(h.harsh_brake, 0) AS harsh_brake, COALESCE(h.harsh_accel, 0) AS harsh_accel,
              COALESCE(h.harsh_turn, 0) AS harsh_turn,
              o.recorded_at AS obd_at, o.rpm, o.speed AS obd_speed, o.coolant_c, o.engine_load_pct, o.throttle_pct,
              o.fuel_pct, o.battery_v, o.odometer_km, o.dtc
       FROM devices d
       LEFT JOIN LATERAL (
         SELECT lat, lng, speed, heading, ignition, recorded_at FROM telemetry
         WHERE device_id = d.id ORDER BY recorded_at DESC LIMIT 1
       ) t ON true
       LEFT JOIN LATERAL (
         SELECT fuel FROM telemetry WHERE device_id = d.id AND fuel IS NOT NULL ORDER BY recorded_at DESC LIMIT 1
       ) f ON true
       LEFT JOIN LATERAL (
         SELECT battery, battery_voltage FROM telemetry
         WHERE device_id = d.id AND (battery IS NOT NULL OR battery_voltage IS NOT NULL)
         ORDER BY recorded_at DESC LIMIT 1
       ) b ON true
       LEFT JOIN LATERAL (
         SELECT MAX(recorded_at) AS last_moved_at FROM telemetry
         WHERE device_id = d.id AND speed > $1 AND recorded_at > now() - interval '24 hours'
       ) m ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (WHERE event = 'harsh_brake') AS harsh_brake,
                COUNT(*) FILTER (WHERE event = 'harsh_accel') AS harsh_accel,
                COUNT(*) FILTER (WHERE event = 'harsh_turn') AS harsh_turn
         FROM telemetry
         WHERE device_id = d.id AND event IS NOT NULL
           AND recorded_at >= (date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2)
       ) h ON true
       LEFT JOIN LATERAL (
         SELECT recorded_at, rpm, speed, coolant_c, engine_load_pct, throttle_pct, fuel_pct, battery_v, odometer_km, dtc
         FROM obd_readings WHERE device_id = d.id ORDER BY recorded_at DESC LIMIT 1
       ) o ON true
       WHERE d.deleted_at IS NULL AND d.is_active = true
       ORDER BY d.name`,
      [MOVING_KMPH, this.app.timeZone],
    );
    const now = new Date();
    const vehicles: DeviceStatusDto[] = rows.map((row) => {
      const status = deviceState(row.last_seen_at, row.speed, row.ignition, now, this.app.onlineWindowSeconds);
      const harsh = { brake: Number(row.harsh_brake), accel: Number(row.harsh_accel), turn: Number(row.harsh_turn) };
      const obd: ObdSnapshotDto | null = row.obd_at
        ? {
            rpm: row.rpm,
            speed: row.obd_speed,
            coolant_c: row.coolant_c,
            engine_load_pct: row.engine_load_pct,
            throttle_pct: row.throttle_pct,
            fuel_pct: row.fuel_pct,
            battery_v: row.battery_v,
            odometer_km: row.odometer_km,
            dtc: row.dtc ?? [],
            at: row.obd_at,
          }
        : null;
      return {
        id: Number(row.id),
        imei: row.imei,
        name: row.name,
        vehicle_no: row.vehicle_no,
        last_seen_at: row.last_seen_at,
        ...status,
        fuel: row.fuel,
        battery: row.battery,
        battery_voltage: row.battery_voltage,
        stopped_since:
          status.state === 'idle' || status.state === 'parked' ? (row.last_moved_at ?? row.recorded_at) : null,
        harsh_today: harsh,
        alerts: [...vehicleAlerts(row.fuel, row.battery, harsh), ...obdAlerts(obd, now, this.app.onlineWindowSeconds)],
        position:
          row.lat === null || row.lng === null || !row.recorded_at
            ? null
            : {
                lat: row.lat,
                lng: row.lng,
                speed: row.speed,
                heading: row.heading,
                ignition: row.ignition,
                recorded_at: row.recorded_at,
              },
        obd,
      };
    });
    const count = (state: DeviceStatusDto['state'][]) => vehicles.filter((item) => state.includes(item.state)).length;
    return {
      total: vehicles.length,
      moving: count(['moving']),
      idle: count(['idle']),
      parked: count(['parked']),
      offline: count(['offline', 'no_data']),
      harsh_events_today: vehicles.reduce(
        (sum, item) => sum + item.harsh_today.brake + item.harsh_today.accel + item.harsh_today.turn,
        0,
      ),
      low_fuel: vehicles.filter((item) => item.alerts.includes('low_fuel')).length,
      engine_faults: vehicles.filter((item) => item.alerts.some((a) => a === 'engine_fault' || a === 'engine_overheat'))
        .length,
      vehicles,
    };
  }

  async status(id: number): Promise<DeviceStatusDto> {
    await this.findOne(id);
    const summary = await this.live();
    const match = summary.vehicles.find((item) => item.id === id);
    if (!match) throw AppException.notFound('Device is not active', 'DEVICE_INACTIVE');
    return match;
  }

  async create(dto: CreateDeviceDto): Promise<Device> {
    await this.assertImeiFree(dto.imei);
    return this.devices.save(this.devices.create(dto));
  }

  private async assertImeiFree(imei: string, exceptId?: number): Promise<void> {
    const existing = await this.devices.findOneBy({ imei });
    if (existing && existing.id !== exceptId) {
      throw AppException.conflict(`IMEI ${imei} is already registered`, 'IMEI_TAKEN');
    }
  }

  findAll(query: DeviceQueryDto): Promise<Paginated<Device>> {
    const qb = this.devices.createQueryBuilder('device');
    if (query.is_active !== undefined) qb.andWhere('device.is_active = :active', { active: query.is_active });
    return listQuery(qb, query, {
      searchable: ['device.name', 'device.imei', 'device.vehicle_no'],
      sortable: {
        created_at: 'device.created_at',
        name: 'device.name',
        imei: 'device.imei',
        last_seen_at: 'device.last_seen_at',
      },
      defaultSort: 'created_at',
    });
  }

  async findOne(id: number): Promise<Device> {
    const device = await this.devices.findOneBy({ id });
    if (!device) throw AppException.notFound('Device not found', 'DEVICE_NOT_FOUND');
    return device;
  }

  async update(id: number, dto: UpdateDeviceDto): Promise<Device> {
    const device = await this.findOne(id);
    if (dto.imei) await this.assertImeiFree(dto.imei, id);
    return this.devices.save(this.devices.merge(device, dto));
  }

  async remove(id: number): Promise<{ id: number }> {
    await this.findOne(id);
    await this.devices.softDelete(id);
    return { id };
  }
}
