# CLAUDE.md — Telematics Service

Standalone NestJS 10 service that ingests tracker data over MQTT and serves vehicle status over HTTP. Its own repo, own PostgreSQL database (`telematics_service`), own Swagger (`:3001/api/docs`). The School API (`C:/Users/DELL/Telematics`) is a client: it calls this service with an API key. Read `README.md` before changing anything a client sees.

## Commands

```bash
npm run start:dev       # http://localhost:3001/api/v1, Swagger at /api/docs
npm run lint && npm test && npm run build
npm run migration:generate -- src/database/migrations/Name
npm run migration:run
npm run simulate -- 860000000000001 5      # original topic telematics/{imei}/telemetry
npm run sim:route -- --vehicles 860000000000001,860000000000002 --interval 2   # Chennai routes on fleet/{imei}/gps and /obd
npm run sim:trip -- --trip 7 --time-scale 2   # drive a trip's device through its stops (reads the trip over REST)
```

## Hard rules

- **No code comments.**
- **No school data here.** No students, parents, staff, users or routes. A trip carries only what the product API sends: a `ref`, stop references, stop names, coordinates and radii, and an optional `started_by` display name. Never add fields that identify a child or a family. Product logic (who rides, who gets notified) stays in the product API.
- **Every route needs `X-Api-Key`** except those marked `@Public()` (only health). Keys come from `API_KEYS` in `.env`, never from code.
- Integer primary keys (telemetry uses bigint), snake_case columns and JSON, `timestamptz` everywhere.
- Responses `{ status, message, data }`; errors through `AppException` with a stable SCREAMING_SNAKE_CASE code. No try/catch in controllers.
- Never hardcode hosts, keys or passwords. Add new settings to `env.validation.ts` and `.env.example`. Never commit `.env`.
- Schema changes only through migrations (`synchronize: false`).

## MQTT

- Topics: `fleet/{imei}/gps`, `fleet/{imei}/obd` and the original `telematics/{imei}/telemetry` (filters `MQTT_GPS_TOPIC`, `MQTT_OBD_TOPIC`, `MQTT_TOPIC_FILTER`, each with exactly one `+`). The `+` segment is always the device IMEI.
- GPS and the original topic share `TelemetryPayloadDto` and `TelemetryService.ingest`. OBD uses `ObdPayloadDto` and `ObdService.ingest` (table `obd_readings`).
- Parse every MQTT payload with `parsePayload(Dto, data)` (`modules/mqtt/payload-parser.ts`); on failure log `<topic> rejected: <reason>` and drop. Unknown IMEIs are logged and dropped. Never throw from an MQTT handler.
- Payload keys stay short like trackers send them (`spd`, `odo`, `coolant`); columns and REST JSON are descriptive snake_case (`speed`, `odometer_km`, `coolant_c`).
- Engine alerts (`engine_fault`, `engine_overheat` above 105 °C) live in `modules/obd/obd-faults.ts` and join the same `alerts` list as `low_fuel`. New alerts go in `VEHICLE_ALERTS`.
- Topic and payload changes are client-visible: update README, the Swagger description and both simulators together.

## Trips (FLEET-05/06)

- `modules/trips/`: `POST /trips`, `POST /trips/:id/end`, `GET /trips`, `GET /trips/:id` (TripState). Tables `trips`, `trip_stops`, `trip_events`. One active trip per device and per `ref` (partial unique indexes).
- `trip-engine.ts` is pure (no Nest, no DB) and holds every rule: ETA, `stop.approaching` (before arrival, once per stop), `stop.arrived`, `stop.departed`, skipped, pickup `arrived_school`, drop `route_complete`. Change rules there and in `trip-engine.spec.ts` together.
- `TelemetryService.record` stores each GPS point (with `source` and `trip_id`) and then calls `TripsService.onPosition` without awaiting it. `TripsService` serialises work per device, caches the active trip per device in memory and persists after every point. A single service instance is assumed.
- Events leave only through `TripWebhookService`: `TRIP_WEBHOOK_URL` + `TRIP_WEBHOOK_SECRET`, header `X-Telematics-Signature: sha256=<HMAC of the raw body>`. Queued events retry 1 s, 5 s, 15 s in order per trip; `trip.position` is throttled to one per 2 s per trip and never retried. Never block MQTT ingest on delivery.
- `POST /devices/:id/positions` is the phone GPS fallback; it is ignored while the tracker sent GPS in the last 60 s.
- Event types, payload shape and end reasons are a contract with the School API (`/api/v1/integrations/telematics/events`). Update README, Swagger and `sim:trip` with any change.

## Structure

`src/common` is shared plumbing (envelope, filter, guard, list helpers). Features go in `src/modules/<feature>/` with `entities/`, `dto/`, service, controller and `*.spec.ts`. Every controller gets `@ApiTags`, `@ApiSecurity('api-key')`, `@ApiOperation` and `@ApiEnvelope`.
