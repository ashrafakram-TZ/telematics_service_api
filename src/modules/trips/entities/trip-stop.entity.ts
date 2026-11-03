import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StopStatus } from '../trip-engine';
import { Trip } from './trip.entity';

@Entity('trip_stops')
@Index('UQ_trip_stops_trip_sequence', ['trip_id', 'sequence'], { unique: true })
export class TripStop {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  trip_id: number;

  @ManyToOne(() => Trip, (trip) => trip.stops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id', foreignKeyConstraintName: 'FK_trip_stops_trip' })
  trip: Trip;

  @Column({ type: 'varchar', length: 64 })
  ref: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'smallint' })
  sequence: number;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'int' })
  radius_m: number;

  @Column({ type: 'varchar', length: 5, nullable: true })
  planned_time: string | null;

  @Column({ type: 'varchar', length: 12, default: 'pending' })
  status: StopStatus;

  @Column({ type: 'int', nullable: true })
  eta_seconds: number | null;

  @Column({ type: 'int', nullable: true })
  distance_m: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  approached_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  arrived_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  departed_at: Date | null;
}
