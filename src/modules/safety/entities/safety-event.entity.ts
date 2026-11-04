import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Device } from '../../devices/entities/device.entity';
import { DeliveryStatus } from '../../trips/entities/trip-event.entity';
import { SafetyKind, SafetySeverity } from '../safety-rules';

@Entity('safety_events')
@Index('IDX_safety_events_device_occurred', ['device_id', 'occurred_at'])
@Index('IDX_safety_events_trip', ['trip_id', 'occurred_at'], { where: 'trip_id IS NOT NULL' })
export class SafetyEvent {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_safety_events' })
  id: number;

  @Column({ type: 'int' })
  device_id: number;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id', foreignKeyConstraintName: 'FK_safety_events_device' })
  device: Device;

  @Column({ type: 'int', nullable: true })
  trip_id: number | null;

  @Column({ type: 'varchar', length: 20 })
  kind: SafetyKind;

  @Column({ type: 'varchar', length: 10 })
  severity: SafetySeverity;

  @Column({ type: 'varchar', length: 200 })
  message: string;

  @Column({ type: 'real', nullable: true })
  value: number | null;

  @Column({ type: 'real', nullable: true })
  limit_value: number | null;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'real', nullable: true })
  speed: number | null;

  @Column({ type: 'timestamptz' })
  occurred_at: Date;

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
