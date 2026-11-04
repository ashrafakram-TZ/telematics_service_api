import { MigrationInterface, QueryRunner } from 'typeorm';

export class SafetyFaults1793766932785 implements MigrationInterface {
  name = 'SafetyFaults1793766932785';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "safety_events" ("id" SERIAL NOT NULL, "device_id" integer NOT NULL, "trip_id" integer, "kind" character varying(20) NOT NULL, "severity" character varying(10) NOT NULL, "message" character varying(200) NOT NULL, "value" real, "limit_value" real, "lat" double precision NOT NULL, "lng" double precision NOT NULL, "speed" real, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "delivery_status" character varying(10) NOT NULL DEFAULT 'pending', "delivery_attempts" smallint NOT NULL DEFAULT '0', "delivered_at" TIMESTAMP WITH TIME ZONE, "last_error" character varying(300), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_safety_events" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_safety_events_trip" ON "safety_events" ("trip_id", "occurred_at") WHERE trip_id IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_safety_events_device_occurred" ON "safety_events" ("device_id", "occurred_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "vehicle_faults" ("id" SERIAL NOT NULL, "device_id" integer NOT NULL, "code" character varying(5) NOT NULL, "description" character varying(150) NOT NULL, "severity" character varying(10) NOT NULL, "odometer_km" double precision, "first_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, "cleared_at" TIMESTAMP WITH TIME ZONE, "delivery_status" character varying(10) NOT NULL DEFAULT 'pending', "delivery_attempts" smallint NOT NULL DEFAULT '0', "delivered_at" TIMESTAMP WITH TIME ZONE, "last_error" character varying(300), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_vehicle_faults" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_vehicle_faults_open_code" ON "vehicle_faults" ("device_id", "code") WHERE cleared_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vehicle_faults_device_seen" ON "vehicle_faults" ("device_id", "first_seen_at") `,
    );
    await queryRunner.query(`ALTER TABLE "devices" ADD "speed_limit_kmh" smallint`);
    await queryRunner.query(
      `ALTER TABLE "safety_events" ADD CONSTRAINT "FK_safety_events_device" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicle_faults" ADD CONSTRAINT "FK_vehicle_faults_device" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "vehicle_faults" DROP CONSTRAINT "FK_vehicle_faults_device"`);
    await queryRunner.query(`ALTER TABLE "safety_events" DROP CONSTRAINT "FK_safety_events_device"`);
    await queryRunner.query(`ALTER TABLE "devices" DROP COLUMN "speed_limit_kmh"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_vehicle_faults_device_seen"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_vehicle_faults_open_code"`);
    await queryRunner.query(`DROP TABLE "vehicle_faults"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_safety_events_device_occurred"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_safety_events_trip"`);
    await queryRunner.query(`DROP TABLE "safety_events"`);
  }
}
