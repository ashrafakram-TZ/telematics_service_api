import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1793630000000 implements MigrationInterface {
  name = 'Init1793630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "devices" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "imei" character varying(15) NOT NULL, "name" character varying(100) NOT NULL, "vehicle_no" character varying(20), "is_active" boolean NOT NULL DEFAULT true, "last_seen_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_devices" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_devices_imei" ON "devices" ("imei") WHERE deleted_at IS NULL`);
    await queryRunner.query(
      `CREATE TABLE "telemetry" ("id" BIGSERIAL NOT NULL, "device_id" integer NOT NULL, "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL, "lat" double precision NOT NULL, "lng" double precision NOT NULL, "speed" real, "heading" smallint, "ignition" boolean, "odometer" double precision, "fuel" real, "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_telemetry" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_telemetry_device_recorded" ON "telemetry" ("device_id", "recorded_at" DESC)`,
    );
    await queryRunner.query(
      `ALTER TABLE "telemetry" ADD CONSTRAINT "FK_telemetry_device" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "telemetry"`);
    await queryRunner.query(`DROP TABLE "devices"`);
  }
}
