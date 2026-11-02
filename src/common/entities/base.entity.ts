import { Column, CreateDateColumn, DeleteDateColumn, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;
}

export abstract class TrackedEntity extends BaseEntity {
  @Column({ type: 'int', nullable: true })
  created_by: number | null;
}

export abstract class SchoolScopedEntity extends TrackedEntity {
  @Index()
  @Column({ type: 'int' })
  school_id: number;
}
