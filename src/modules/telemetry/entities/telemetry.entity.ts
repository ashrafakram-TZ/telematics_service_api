import { Device } from '../../devices/entities/device.entity';
import { DrivingEvent } from '../dto/telemetry-payload.dto';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity('telemetry')
@Index('IDX_telemetry_device_recorded', { synchronize: false })
export class Telemetry {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'int' })
  device_id: number;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
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

  @CreateDateColumn({ type: 'timestamptz' })
  received_at: Date;
}
