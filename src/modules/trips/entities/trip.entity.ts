import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common';
import { Device } from '../../devices/entities/device.entity';
import { EndReason, PositionSource, TripKind, TripStatus } from '../trip-engine';
import { TripStop } from './trip-stop.entity';

@Entity('trips')
@Index('UQ_trips_active_ref', ['ref'], { unique: true, where: `status = 'active'` })
@Index('UQ_trips_active_device', ['device_id'], { unique: true, where: `status = 'active'` })
@Index('IDX_trips_device_started', ['device_id', 'started_at'])
export class Trip extends BaseEntity {
  @Column({ type: 'varchar', length: 64 })
  ref: string;

  @Column({ type: 'int' })
  device_id: number;

  @ManyToOne(() => Device, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'device_id', foreignKeyConstraintName: 'FK_trips_device' })
  device: Device;

  @Column({ type: 'varchar', length: 10 })
  kind: TripKind;

  @Column({ type: 'varchar', length: 10, default: 'active' })
  status: TripStatus;

  @Column({ type: 'smallint' })
  approach_minutes: number;

  @Column({ type: 'int' })
  approach_metres: number;

  @Column({ type: 'varchar', length: 150 })
  destination_name: string;

  @Column({ type: 'double precision' })
  destination_lat: number;

  @Column({ type: 'double precision' })
  destination_lng: number;

  @Column({ type: 'int' })
  destination_radius_m: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  started_by: string | null;

  @Column({ type: 'timestamptz' })
  started_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  ended_at: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  end_reason: EndReason | null;

  @Column({ type: 'double precision', nullable: true })
  position_lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  position_lng: number | null;

  @Column({ type: 'real', nullable: true })
  position_speed: number | null;

  @Column({ type: 'smallint', nullable: true })
  position_heading: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  position_at: Date | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  position_source: PositionSource | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  next_stop_ref: string | null;

  @Column({ type: 'int', nullable: true })
  destination_eta_seconds: number | null;

  @OneToMany(() => TripStop, (stop) => stop.trip, { cascade: ['insert'] })
  stops: TripStop[];
}
