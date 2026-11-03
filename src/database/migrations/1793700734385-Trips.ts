import { MigrationInterface, QueryRunner } from 'typeorm';

export class Trips1793700734385 implements MigrationInterface {
  name = 'Trips1793700734385';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "trip_stops" ("id" SERIAL NOT NULL, "trip_id" integer NOT NULL, "ref" character varying(64) NOT NULL, "name" character varying(150) NOT NULL, "sequence" smallint NOT NULL, "lat" double precision NOT NULL, "lng" double precision NOT NULL, "radius_m" integer NOT NULL, "planned_time" character varying(5), "status" character varying(12) NOT NULL DEFAULT 'pending', "eta_seconds" integer, "distance_m" integer, "approached_at" TIMESTAMP WITH TIME ZONE, "arrived_at" TIMESTAMP WITH TIME ZONE, "departed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_trip_stops" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_trip_stops_trip_sequence" ON "trip_stops" ("trip_id", "sequence") `,
    );
    await queryRunner.query(
      `CREATE TABLE "trips" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "ref" character varying(64) NOT NULL, "device_id" integer NOT NULL, "kind" character varying(10) NOT NULL, "status" character varying(10) NOT NULL DEFAULT 'active', "approach_minutes" smallint NOT NULL, "approach_metres" integer NOT NULL, "destination_name" character varying(150) NOT NULL, "destination_lat" double precision NOT NULL, "destination_lng" double precision NOT NULL, "destination_radius_m" integer NOT NULL, "started_by" character varying(100), "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ended_at" TIMESTAMP WITH TIME ZONE, "end_reason" character varying(20), "position_lat" double precision, "position_lng" double precision, "position_speed" real, "position_heading" smallint, "position_at" TIMESTAMP WITH TIME ZONE, "position_source" character varying(10), "next_stop_ref" character varying(64), "destination_eta_seconds" integer, CONSTRAINT "PK_trips" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_trips_device_started" ON "trips" ("device_id", "started_at") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_trips_active_device" ON "trips" ("device_id") WHERE status = 'active'`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_trips_active_ref" ON "trips" ("ref") WHERE status = 'active'`);
    await queryRunner.query(
      `CREATE TABLE "trip_events" ("id" SERIAL NOT NULL, "trip_id" integer NOT NULL, "type" character varying(24) NOT NULL, "stop_id" integer, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "payload" jsonb NOT NULL, "delivery_status" character varying(10) NOT NULL DEFAULT 'pending', "delivery_attempts" smallint NOT NULL DEFAULT '0', "delivered_at" TIMESTAMP WITH TIME ZONE, "last_error" character varying(300), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_trip_events" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_trip_events_trip" ON "trip_events" ("trip_id", "id") `);
    await queryRunner.query(`ALTER TABLE "telemetry" ADD "source" character varying(10)`);
    await queryRunner.query(`ALTER TABLE "telemetry" ADD "trip_id" integer`);
    await queryRunner.query(
      `CREATE INDEX "IDX_telemetry_trip" ON "telemetry" ("trip_id", "recorded_at") WHERE trip_id IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_stops" ADD CONSTRAINT "FK_trip_stops_trip" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ADD CONSTRAINT "FK_trips_device" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_events" ADD CONSTRAINT "FK_trip_events_trip" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trip_events" DROP CONSTRAINT "FK_trip_events_trip"`);
    await queryRunner.query(`ALTER TABLE "trips" DROP CONSTRAINT "FK_trips_device"`);
    await queryRunner.query(`ALTER TABLE "trip_stops" DROP CONSTRAINT "FK_trip_stops_trip"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_telemetry_trip"`);
    await queryRunner.query(`ALTER TABLE "telemetry" DROP COLUMN "trip_id"`);
    await queryRunner.query(`ALTER TABLE "telemetry" DROP COLUMN "source"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_trip_events_trip"`);
    await queryRunner.query(`DROP TABLE "trip_events"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_trips_active_ref"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_trips_active_device"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_trips_device_started"`);
    await queryRunner.query(`DROP TABLE "trips"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_trip_stops_trip_sequence"`);
    await queryRunner.query(`DROP TABLE "trip_stops"`);
  }
}
