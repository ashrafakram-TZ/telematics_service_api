import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppException, listQuery, Paginated } from '../../common';
import { appConfig, AppConfig } from '../../config/configuration';
import { deviceState } from './device-state';
import { DeviceStatusDto, FleetSummaryDto } from './dto/device-status.dto';
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
      fuel: number | null;
      recorded_at: Date | null;
    })[] = await this.dataSource.query(
      `SELECT d.id, d.imei, d.name, d.vehicle_no, d.last_seen_at, t.lat, t.lng, t.speed, t.heading, t.ignition, t.fuel, t.recorded_at
       FROM devices d
       LEFT JOIN LATERAL (
         SELECT lat, lng, speed, heading, ignition, fuel, recorded_at FROM telemetry
         WHERE device_id = d.id ORDER BY recorded_at DESC LIMIT 1
       ) t ON true
       WHERE d.deleted_at IS NULL AND d.is_active = true
       ORDER BY d.name`,
    );
    const now = new Date();
    const vehicles: DeviceStatusDto[] = rows.map((row) => ({
      id: Number(row.id),
      imei: row.imei,
      name: row.name,
      vehicle_no: row.vehicle_no,
      last_seen_at: row.last_seen_at,
      ...deviceState(row.last_seen_at, row.speed, now, this.app.onlineWindowSeconds),
      position:
        row.lat === null || row.lng === null || !row.recorded_at
          ? null
          : {
              lat: row.lat,
              lng: row.lng,
              speed: row.speed,
              heading: row.heading,
              ignition: row.ignition,
              fuel: row.fuel,
              recorded_at: row.recorded_at,
            },
    }));
    return {
      total: vehicles.length,
      moving: vehicles.filter((item) => item.state === 'moving').length,
      idle: vehicles.filter((item) => item.state === 'idle').length,
      offline: vehicles.filter((item) => item.state === 'offline' || item.state === 'no_data').length,
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
