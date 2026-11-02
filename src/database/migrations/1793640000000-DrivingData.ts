import { MigrationInterface, QueryRunner } from 'typeorm';

export class DrivingData1793640000000 implements MigrationInterface {
  name = 'DrivingData1793640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "telemetry" ADD "battery" smallint`);
    await queryRunner.query(`ALTER TABLE "telemetry" ADD "battery_voltage" real`);
    await queryRunner.query(`ALTER TABLE "telemetry" ADD "event" character varying(15)`);
    await queryRunner.query(
      `CREATE INDEX "IDX_telemetry_device_events" ON "telemetry" ("device_id", "recorded_at") WHERE event IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_telemetry_device_events"`);
    await queryRunner.query(`ALTER TABLE "telemetry" DROP COLUMN "event"`);
    await queryRunner.query(`ALTER TABLE "telemetry" DROP COLUMN "battery_voltage"`);
    await queryRunner.query(`ALTER TABLE "telemetry" DROP COLUMN "battery"`);
  }
}
