import { BaseEntity } from '../../../common';
import { Column, Entity, Index } from 'typeorm';

@Entity('devices')
@Index('UQ_devices_imei', ['imei'], { unique: true, where: 'deleted_at IS NULL' })
export class Device extends BaseEntity {
  @Column({ type: 'varchar', length: 15 })
  imei: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  vehicle_no: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'smallint', nullable: true })
  speed_limit_kmh: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_seen_at: Date | null;
}
