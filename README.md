# Telematics Service

Vehicle tracking service for Tamilzorous products. GPS/OBD trackers publish over MQTT; this service stores the positions in its own PostgreSQL database and serves them over HTTP. The School Management System reads bus status from it; it never touches school data.

Stack: NestJS 10, TypeORM, PostgreSQL, MQTT (REST and MQTT run in one process).

## Setup

```bash
npm install
cp .env.example .env          # set DB_*, API_KEYS, MQTT_*
createdb telematics_service   # or create it in pgAdmin
npm run migration:run
npm run start:dev
```

- HTTP: `http://<host>:3001/api/v1`. It listens on all network interfaces (`HOST=0.0.0.0`), so other machines on the LAN can reach it. The start log prints every address.
- Swagger: `http://<host>:3001/api/docs` (JSON at `/api/docs-json`). Click **Authorize** and paste an API key.
- Health: `GET /api/health` needs no key and returns `db` and `mqtt` status.

## Web console

The internal web console (dashboard, devices, MQTT console) is a separate project: `C:/Users/DELL/telematics-web`, port 5174.

## Who calls it and how

Server to server only. Browsers and mobile apps call their own product API, which calls this service.

| Header | Value |
|---|---|
| `X-Api-Key` | One of the comma-separated keys in `API_KEYS` (32+ characters each, one per client app) |

No key returns `401 API_KEY_MISSING`; a wrong key returns `401 API_KEY_INVALID`. Rotate a key by adding the new one, updating the client, then removing the old one.

## Endpoints

| Method and path | Purpose |
|---|---|
| `GET /devices/live` | Every active vehicle with state `moving`, `idle`, `offline` or `no_data`, and its last position |
| `GET /devices/{id}/status` | Same for one vehicle |
| `GET /devices` | List, search, sort and page devices |
| `POST /devices`, `PATCH /devices/{id}`, `DELETE /devices/{id}` | Register and manage trackers (IMEI must be unique: `409 IMEI_TAKEN`) |
| `GET /devices/{id}/telemetry/latest` | Latest position |
| `GET /devices/{id}/telemetry?from&to&page&limit` | Position history for trip playback |

A vehicle is online when it reported within `ONLINE_WINDOW_SECONDS` (default 120) and moving above 2 km/h.

Responses use `{ status, message, data }` and errors use `{ status, error, message, errors? }`, the same as the School API.

## MQTT

Trackers publish to `telematics/{imei}/telemetry` (`MQTT_TOPIC_FILTER`):

```json
{ "ts": 1793259595, "lat": 13.0827, "lng": 80.2707, "spd": 42, "hdg": 180, "ign": 1, "odo": 12345.6, "fuel": 56 }
```

`ts` is the current Unix time in seconds. Invalid messages and unknown IMEIs are logged and dropped. If the broker is down, HTTP still starts and the client retries every 5 seconds.

Test without a tracker: `npm run simulate -- 860000000000001 5` publishes a moving bus every 5 seconds. A local broker config is in `mosquitto/`.

## Scripts

| Script | Purpose |
|---|---|
| `start:dev` / `build` / `start:prod` | Watch mode, compile, run the build |
| `lint` / `format` / `test` | ESLint, Prettier, unit tests |
| `migration:generate -- src/database/migrations/Name` / `migration:run` / `migration:revert` | Database migrations |
| `simulate -- <imei> <seconds>` | Publish fake GPS for one tracker |

## Structure

```
src/
  main.ts                 HTTP + MQTT bootstrap, prints LAN addresses
  app.module.ts app.setup.ts swagger.ts
  config/                 typed config, env validation (fails fast), MQTT config
  common/                 response envelope, error filter, validation pipe, API key guard,
                          list/search/paging helpers, Swagger helpers, base entity
  database/               TypeORM module, CLI data source, migrations
  modules/
    devices/              trackers and live vehicle status
    telemetry/            MQTT ingest and position history
    mqtt/                 broker connection status
    health/               /api/health
  tools/simulate-bus.ts   fake tracker for demos
mosquitto/                local broker config
```
