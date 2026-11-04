import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Device } from '../../devices/entities/device.entity';
import { DeliveryStatus } from '../../trips/entities/trip-event.entity';
import { FaultSeverity } from '../obd-faults';

@Entity('vehicle_faults')
@Index('IDX_vehicle_faults_device_seen', ['device_id', 'first_seen_at'])
@Index('UQ_vehicle_faults_open_code', ['device_id', 'code'], { unique: true, where: 'cleared_at IS NULL' })
export class VehicleFault {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_vehicle_faults' })
  id: number;

  @Column({ type: 'int' })
  device_id: number;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id', foreignKeyConstraintName: 'FK_vehicle_faults_device' })
  device: Device;

  @Column({ type: 'varchar', length: 5 })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  description: string;

  @Column({ type: 'varchar', length: 10 })
  severity: FaultSeverity;

  @Column({ type: 'double precision', nullable: true })
  odometer_km: number | null;

  @Column({ type: 'timestamptz' })
  first_seen_at: Date;

  @Column({ type: 'timestamptz' })
  last_seen_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  cleared_at: Date | null;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  delivery_status: DeliveryStatus;

  @Column({ type: 'smallint', default: 0 })
  delivery_attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  delivered_at: Date | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  last_error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
