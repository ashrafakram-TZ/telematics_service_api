import { MigrationInterface, QueryRunner } from 'typeorm';

export class ObdReadings1793682506734 implements MigrationInterface {
  name = 'ObdReadings1793682506734';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "obd_readings" ("id" BIGSERIAL NOT NULL, "device_id" integer NOT NULL, "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL, "rpm" smallint, "speed" real, "coolant_c" real, "engine_load_pct" real, "throttle_pct" real, "fuel_pct" real, "battery_v" real, "odometer_km" double precision, "dtc" character varying(5) array NOT NULL DEFAULT '{}', "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_obd_readings" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_obd_readings_device_recorded" ON "obd_readings" ("device_id", "recorded_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "obd_readings" ADD CONSTRAINT "FK_obd_readings_device" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "obd_readings" DROP CONSTRAINT "FK_obd_readings_device"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_obd_readings_device_recorded"`);
    await queryRunner.query(`DROP TABLE "obd_readings"`);
  }
}
