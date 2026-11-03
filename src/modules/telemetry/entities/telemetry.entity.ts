import { Device } from '../../devices/entities/device.entity';
import { PositionSource } from '../../trips/trip-engine';
import { DrivingEvent } from '../dto/telemetry-payload.dto';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity('telemetry')
@Index('IDX_telemetry_device_recorded', { synchronize: false })
@Index('IDX_telemetry_device_events', { synchronize: false })
@Index('IDX_telemetry_trip', ['trip_id', 'recorded_at'], { where: 'trip_id IS NOT NULL' })
export class Telemetry {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'int' })
  device_id: number;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id', foreignKeyConstraintName: 'FK_telemetry_device' })
  device: Device;

  @Column({ type: 'timestamptz' })
  recorded_at: Date;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'real', nullable: true })
  speed: number | null;

  @Column({ type: 'smallint', nullable: true })
  heading: number | null;

  @Column({ type: 'boolean', nullable: true })
  ignition: boolean | null;

  @Column({ type: 'double precision', nullable: true })
  odometer: number | null;

  @Column({ type: 'real', nullable: true })
  fuel: number | null;

  @Column({ type: 'smallint', nullable: true })
  battery: number | null;

  @Column({ type: 'real', nullable: true })
  battery_voltage: number | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  event: DrivingEvent | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  source: PositionSource | null;

  @Column({ type: 'int', nullable: true })
  trip_id: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  received_at: Date;
}
