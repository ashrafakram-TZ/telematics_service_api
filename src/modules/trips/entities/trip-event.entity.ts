import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TripEventType } from '../trip-engine';
import { Trip } from './trip.entity';

export const DELIVERY_STATUSES = ['pending', 'delivered', 'failed', 'off'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

@Entity('trip_events')
@Index('IDX_trip_events_trip', ['trip_id', 'id'])
export class TripEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  trip_id: number;

  @ManyToOne(() => Trip, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id', foreignKeyConstraintName: 'FK_trip_events_trip' })
  trip: Trip;

  @Column({ type: 'varchar', length: 24 })
  type: TripEventType;

  @Column({ type: 'int', nullable: true })
  stop_id: number | null;

  @Column({ type: 'timestamptz' })
  occurred_at: Date;

  @Column({ type: 'jsonb' })
  payload: object;

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
