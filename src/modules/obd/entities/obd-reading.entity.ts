import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Device } from '../../devices/entities/device.entity';

@Entity('obd_readings')
@Index('IDX_obd_readings_device_recorded', ['device_id', 'recorded_at'])
export class ObdReading {
  @PrimaryGeneratedColumn({ type: 'bigint', primaryKeyConstraintName: 'PK_obd_readings' })
  id: string;

  @Column({ type: 'int' })
  device_id: number;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id', foreignKeyConstraintName: 'FK_obd_readings_device' })
  device: Device;

  @Column({ type: 'timestamptz' })
  recorded_at: Date;

  @Column({ type: 'smallint', nullable: true })
  rpm: number | null;

  @Column({ type: 'real', nullable: true })
  speed: number | null;

  @Column({ type: 'real', nullable: true })
  coolant_c: number | null;

  @Column({ type: 'real', nullable: true })
  engine_load_pct: number | null;

  @Column({ type: 'real', nullable: true })
  throttle_pct: number | null;

  @Column({ type: 'real', nullable: true })
  fuel_pct: number | null;

  @Column({ type: 'real', nullable: true })
  battery_v: number | null;

  @Column({ type: 'double precision', nullable: true })
  odometer_km: number | null;

  @Column({ type: 'varchar', length: 5, array: true, default: () => "'{}'" })
  dtc: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  received_at: Date;
}
