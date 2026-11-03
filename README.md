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
| `GET /devices/{id}/obd/latest` | Latest OBD reading (`404 NO_OBD_DATA` when none yet) |
| `GET /devices/{id}/obd?from&to&page&limit` | OBD history, newest first, paged like positions (max 100 per page) |

A vehicle is online when it reported within `ONLINE_WINDOW_SECONDS` (default 120) and moving above 2 km/h.

Responses use `{ status, message, data }` and errors use `{ status, error, message, errors? }`, the same as the School API.

## MQTT

The service subscribes to three topic filters. In each, the `+` segment is the **device IMEI**: the 15-digit `imei` registered with `POST /devices`, the same key the original topic already used. Trackers know their IMEI, so no extra mapping is needed. Messages for an IMEI that is not registered and active are logged and dropped.

| Topic | Setting (default) | Payload |
|---|---|---|
| `fleet/{imei}/gps` | `MQTT_GPS_TOPIC` (`fleet/+/gps`) | GPS, below |
| `fleet/{imei}/obd` | `MQTT_OBD_TOPIC` (`fleet/+/obd`) | OBD engine data, below |
| `telematics/{imei}/telemetry` | `MQTT_TOPIC_FILTER` (`telematics/+/telemetry`) | The original combined topic: same payload as GPS, still supported |

Each filter must contain exactly one `+` (checked at start-up).

### GPS (`fleet/{imei}/gps` and `telematics/{imei}/telemetry`)

```json
{ "ts": 1793259595, "lat": 13.0827, "lng": 80.2707, "spd": 42, "hdg": 180, "ign": 1, "odo": 12345.6,
  "fuel": 56, "bat": 88, "volt": 12.6, "evt": "harsh_brake" }
```

| Field | Meaning |
|---|---|
| `ts`, `lat`, `lng` | Required: Unix time in seconds and position |
| `spd`, `hdg`, `odo` | Speed km/h, heading 0–359, odometer km |
| `ign` | Ignition 1 on, 0 off |
| `fuel` | Fuel level % |
| `bat`, `volt` | Vehicle battery % and volts |
| `evt` | Only when it happens: `harsh_brake`, `harsh_accel` (harsh riding) or `harsh_turn` |

Both topics go through the same ingest, so positions, live state, harsh events and alerts work the same whichever topic a tracker uses.

### OBD (`fleet/{imei}/obd`)

```json
{ "ts": 1793259595, "rpm": 1450, "spd": 34, "coolant": 89.5, "load": 42, "throttle": 18,
  "fuel": 63.4, "volt": 13.9, "odo": 48213.7, "dtc": ["P0301"] }
```

| Field | Range | Stored as |
|---|---|---|
| `ts` | Required, Unix seconds, last 30 days to 5 minutes ahead | `recorded_at` |
| `rpm` | 0–10000 | `rpm` (rounded) |
| `spd` | 0–255 km/h (ECU speed) | `speed` |
| `coolant` | -40–215 °C | `coolant_c` |
| `load` | 0–100 % calculated engine load | `engine_load_pct` |
| `throttle` | 0–100 % | `throttle_pct` |
| `fuel` | 0–100 % | `fuel_pct` |
| `volt` | 0–60 V | `battery_v` |
| `odo` | 0 or more km | `odometer_km` |
| `dtc` | Up to 20 active trouble codes like `P0301` (P, C, B or U, then 4 hex digits); `[]` when clear | `dtc` |

`ts` and at least one reading are required; every other field may be left out. A message out of range, with a malformed code or with no readings is logged with the reason (for example `fleet/860000000000001/obd rejected: coolant must be between -40 and 215 °C (received coolant=400)`) and dropped. Readings are stored in `obd_readings`. OBD does not change `last_seen_at` or the vehicle state; those come from GPS.

### What live status shows

`GET /devices/live` and `GET /devices/{id}/status` turn this into: state `moving`, `idle` (stopped, engine on), `parked` (engine off) or `offline`; how long it has been stopped; last fuel and battery; harsh events since midnight; the latest OBD reading as `obd` (`null` when none):

```json
"obd": { "rpm": 1450, "speed": 34, "coolant_c": 89.5, "engine_load_pct": 42, "throttle_pct": 18, "fuel_pct": 63.4,
         "battery_v": 13.9, "odometer_km": 48213.7, "dtc": ["P0301"], "at": "2026-11-03T08:15:00.000+05:30" }
```

and `alerts`:

| Alert | When |
|---|---|
| `low_fuel` | GPS fuel below 15% |
| `low_battery` | GPS battery below 20% |
| `harsh_driving` | Any harsh event today |
| `engine_fault` | Latest OBD reading (within 24 hours) has active DTC codes |
| `engine_overheat` | Latest OBD coolant above 105 °C, reported within `ONLINE_WINDOW_SECONDS` |

The fleet summary also counts `engine_faults` (vehicles with either engine alert).

`ts` is the current Unix time in seconds. If the broker is down, HTTP still starts and the client retries every 5 seconds. A local broker config is in `mosquitto/`.

## Simulators

Both publish to `MQTT_URL` from `.env` unless told otherwise. Register the IMEIs with `POST /devices` first, or the service drops their messages.

**Single bus, original topic** (unchanged): `npm run simulate -- 860000000000001 5` publishes a bus on a short loop to `telematics/{imei}/telemetry` every 5 seconds.

**Recorded Chennai routes** (`npm run sim:route`): replays road-following routes, publishing GPS to `fleet/{imei}/gps` and OBD to `fleet/{imei}/obd` (topics follow `MQTT_GPS_TOPIC` / `MQTT_OBD_TOPIC`).

```bash
npm run sim:route -- --list
npm run sim:route -- --vehicles 860000000000001 --route anna-nagar-kilpauk
npm run sim:route -- --vehicles 860000000000001,860000000000002,860000000000003 --interval 2
npm run sim:route -- --vehicles 860000000000001,860000000000002 --route t-nagar-guindy --time-scale 5 --faults 860000000000002
npm run sim:route -- --broker mqtt://localhost:1883 --duration 120 --quiet
```

| Flag | Default | Meaning |
|---|---|---|
| `--route` | `all` | `anna-nagar-kilpauk`, `t-nagar-guindy`, `velachery-tambaram`, or `all` (buses take the routes in turn) |
| `--vehicles` | `860000000000001` | Comma-separated IMEIs; buses on the same route start spread out along it |
| `--interval` | `2` | Seconds between messages per bus |
| `--time-scale` | `1` | Simulated seconds per real second (drive faster for demos) |
| `--obd-every` | `1` | Publish OBD every n GPS messages |
| `--duration` | `0` | Stop after n seconds (0 = until Ctrl+C) |
| `--broker` | `MQTT_URL` | Broker URL |
| `--faults` | none | IMEIs that overheat and report DTC `P0217` after a minute of running |
| `--quiet`, `--list`, `--help` | | Less output, show the routes, usage |

Routes (`src/tools/chennai-routes.ts`) are ordered lat/lng traces about 150 m apart with named stops; the bus interpolates between points, so it moves smoothly at any interval:

| Route | Points | Length | Via |
|---|---|---|---|
| `anna-nagar-kilpauk` | 36 | 4.9 km | Thirumangalam, 2nd Avenue, Anna Nagar East, Shenoy Nagar, Poonamallee High Road, Pachaiyappa's College, Kilpauk |
| `t-nagar-guindy` | 35 | 5.4 km | Panagal Park, Venkatanarayana Road, Nandanam, Anna Salai, Saidapet, Little Mount, Guindy |
| `velachery-tambaram` | 87 | 12.7 km | Velachery, Velachery–Tambaram Main Road, Pallikaranai, Kovilambakkam, Camp Road, Selaiyur, Tambaram (GST Road) |

The traces follow the road alignments closely but were drawn from map knowledge, not a GPS logger; replace a route's `points` with a real recording when one is available.

Each bus accelerates and brakes into stops, dwells 20–40 s at stops (idle: engine on, about 750 rpm), stops at the odd signal, parks with the engine off for 1–2 minutes at the end of the route and then drives it back. Fuel drops with distance and idling (refilled when below 20% at the end of a trip), coolant warms to about 90 °C, rpm, load and throttle follow speed, and there is an occasional `harsh_brake` or `harsh_accel`.

## Scripts

| Script | Purpose |
|---|---|
| `start:dev` / `build` / `start:prod` | Watch mode, compile, run the build |
| `lint` / `format` / `test` | ESLint, Prettier, unit tests |
| `migration:generate -- src/database/migrations/Name` / `migration:run` / `migration:revert` | Database migrations |
| `simulate -- <imei> <seconds>` | Publish fake GPS for one tracker on the original topic |
| `sim:route -- [flags]` | Replay recorded Chennai routes: GPS and OBD for one or more buses |

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
    telemetry/            GPS ingest (fleet/+/gps and telematics/+/telemetry) and position history
    obd/                  OBD ingest (fleet/+/obd), OBD history, engine fault rules
    mqtt/                 broker connection status, topic filters, payload parser
    health/               /api/health
  tools/simulate-bus.ts   fake tracker for demos (original topic)
  tools/simulate-route.ts route simulator CLI (bus-model.ts, route-math.ts, chennai-routes.ts)
mosquitto/                local broker config
```
