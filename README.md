# Telematics Service

Vehicle tracking service for Tamilzorous products. GPS/OBD trackers publish over MQTT; this service stores the positions in its own PostgreSQL database and serves them over HTTP. It also runs trips: the product API starts a trip with its stops, and this service follows the bus through them, works out ETAs and calls the product back with events (stop approaching, arrived, departed, trip ended). The School Management System reads bus status from it. It never holds student, parent or staff data: a trip carries only stop references, names and coordinates.

Stack: NestJS 10, TypeORM, PostgreSQL, MQTT (REST and MQTT run in one process).

## Setup

```bash
npm install
cp .env.example .env          # set DB_*, API_KEYS, MQTT_*, TRIP_WEBHOOK_*, optional SAFETY_*
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
| `POST /devices`, `PATCH /devices/{id}`, `DELETE /devices/{id}` | Register and manage trackers (IMEI must be unique: `409 IMEI_TAKEN`); optional `speed_limit_kmh` (10–200) overrides `SAFETY_SPEED_LIMIT_KMH` for that vehicle |
| `GET /devices/{id}/telemetry/latest` | Latest position |
| `GET /devices/{id}/telemetry?from&to&page&limit` | Position history for trip playback |
| `GET /devices/{id}/obd/latest` | Latest OBD reading (`404 NO_OBD_DATA` when none yet) |
| `GET /devices/{id}/obd?from&to&page&limit` | OBD history, newest first, paged like positions (max 100 per page) |
| `POST /devices/{id}/positions` | Phone GPS fallback: same payload as the GPS topic, `202` (see [Trips](#trips)) |
| `POST /trips` | Create and start a trip (`201`, TripState) |
| `POST /trips/{id}/end` | End a trip by hand, body `{ "reason": "driver" }` (`driver` or `admin`) |
| `GET /trips/{id}` | TripState: position, stop statuses and ETAs |
| `GET /trips?status&device_id&ref&page&limit` | Trips, newest first (`status` is `active` or `ended`) |
| `GET /trips/{id}/playback?max_points` | Trip replay: GPS track oldest first, planned path, stop arrivals, safety events (see [Trip playback](#trip-playback)) |
| `GET /safety-events?device_id&trip_id&kind&severity&from&to&page&limit` | Safety events, newest first (see [Safety rules](#safety-rules)) |
| `GET /devices/{id}/health` | Vehicle health card: latest engine readings, active fault codes with descriptions, `good` / `warning` / `critical` / `unknown` |
| `GET /devices/{id}/faults?status&from&to&page&limit` | Fault code log: when each code appeared, was last seen and cleared (`status` is `open` or `cleared`) |

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

## Trips

A trip is one bus run. The product API (the School API) creates it with the stops in order and a destination (the school); the service then runs the trip engine on every GPS point of that device and sends events back through a signed webhook.

### Create: `POST /trips`

```json
{
  "ref": "TZMS-41",
  "device_id": 1,
  "kind": "pickup",
  "approach_minutes": 5,
  "approach_metres": 800,
  "stops": [
    { "ref": "12", "name": "Mogappair East bus stand", "sequence": 1, "lat": 13.0846, "lng": 80.1767, "radius_m": 120, "planned_time": "07:00" }
  ],
  "destination": { "name": "Tamilzorous Model School", "lat": 13.0878, "lng": 80.2101, "radius_m": 200 },
  "started_by": "Ganesan Pillai"
}
```

| Field | Rule |
|---|---|
| `ref` | 1–64 characters, unique among active trips (`409 TRIP_REF_ACTIVE`) |
| `device_id` | Must exist (`404 DEVICE_NOT_FOUND`); one active trip per device (`409 TRIP_ALREADY_ACTIVE`) |
| `kind` | `pickup`: stops in order, then the destination ends the trip. `drop`: starts at the destination, visits the stops in order and ends after the last stop |
| `approach_minutes` | 1–30, default 5 |
| `approach_metres` | 100–5000, default 800 |
| `stops` | 1–60; `sequence` and `ref` unique in the trip (`400 DUPLICATE_STOP_SEQUENCE` / `DUPLICATE_STOP_REF`); `radius_m` 30–1000, default 120; `planned_time` optional `HH:mm` |
| `destination` | `radius_m` 30–1000, default 200 |
| `started_by` | Optional display name, up to 100 characters |

The response (`201`) is the TripState and `trip.started` is sent.

### TripState (`GET /trips/{id}`, list items, create and end responses)

```json
{
  "id": 7, "ref": "TZMS-41", "device_id": 1, "kind": "pickup", "status": "active",
  "started_at": "2026-11-09T06:55:00.000+05:30", "ended_at": null, "end_reason": null,
  "position": { "lat": 13.08, "lng": 80.19, "speed": 28, "heading": 90, "recorded_at": "2026-11-09T07:12:30.000+05:30", "source": "device" },
  "next_stop_ref": "12",
  "destination_eta_seconds": 1260,
  "stops": [
    { "ref": "12", "name": "Mogappair East bus stand", "sequence": 1, "status": "pending", "eta_seconds": 300, "distance_m": 2100,
      "approached_at": null, "arrived_at": null, "departed_at": null,
      "lat": 13.0846, "lng": 80.1767, "radius_m": 120, "planned_time": "07:00" }
  ],
  "destination": { "name": "Tamilzorous Model School", "lat": 13.0878, "lng": 80.2101, "radius_m": 200 },
  "approach_minutes": 5, "approach_metres": 800, "started_by": "Ganesan Pillai"
}
```

- `status`: `active` or `ended`. `end_reason`: `arrived_school`, `route_complete`, `driver`, `admin` or `timeout`.
- Stop `status`: `pending`, `approaching`, `arrived`, `departed`, `skipped`.
- `next_stop_ref`: the first stop not yet departed or skipped (the stop the bus is at, while it is there).
- `destination_eta_seconds`: pickup only; always `null` on a drop trip (it ends at its last stop).
- `position` is `null` until the device reports (a position from the last 5 minutes is copied in at start).

`POST /trips/{id}/end` with `{ "reason": "driver" }` or `"admin"` ends it: a stop the bus is at is departed, stops not reached are skipped and `trip.ended` is sent. Ending an ended trip returns it unchanged and sends nothing.

### Trip engine

It runs on every accepted GPS point of a device that has an active trip, from MQTT or from the phone fallback, in order per device.

| Rule | Behaviour |
|---|---|
| ETA | Remaining path: current point, then each stop not yet reached in order, then the destination (pickup). Straight lines between them, divided by the average speed of the last 2 minutes of points, clamped to 12–40 km/h. Each stop gets `eta_seconds` and `distance_m`; the stop the bus is at shows 0 |
| `stop.approaching` | Once per stop, when its ETA is at most `approach_minutes` or its path distance at most `approach_metres`, and the bus is not yet inside its radius. If the first point near a stop is already inside it, `stop.approaching` and `stop.arrived` are sent together, in that order, so approaching always comes first |
| `stop.arrived` | The bus enters the stop radius |
| `stop.departed` | The bus leaves the radius of the stop it arrived at, or is already inside a later stop |
| skipped | When the bus arrives at a later stop, earlier stops it never reached become `skipped` (no event) |
| Pickup end | Inside the destination radius and either every stop is departed or skipped, or the trip started more than 3 minutes ago: `trip.ended` with `arrived_school` |
| Drop end | The last stop is departed: `trip.ended` with `route_complete` |
| Timeout | Checked every minute: no GPS for 4 hours, or started more than 6 hours ago: `trip.ended` with `timeout` |

Trips, stops and every event are stored (`trips`, `trip_stops`, `trip_events`), so state survives a restart. Points older than the trip's last position are stored but not used by the engine.

### Webhook

Set `TRIP_WEBHOOK_URL` (for the School API: `http://<host>:3000/api/v1/integrations/telematics/events`) and `TRIP_WEBHOOK_SECRET` (32+ characters, shared with the receiver). An empty URL turns webhooks off (logged once at start-up; events are still stored with `delivery_status = off`).

Every event is a `POST` with:

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-Telematics-Event` | the event type |
| `X-Telematics-Signature` | `sha256=<hex HMAC-SHA256 of the exact raw body, keyed with TRIP_WEBHOOK_SECRET>` |

```json
{
  "id": 1501,
  "type": "stop.approaching",
  "at": "2026-11-09T07:12:30.000+05:30",
  "trip": { "id": 7, "ref": "TZMS-41", "device_id": 1, "kind": "pickup" },
  "stop": { "ref": "12", "name": "Mogappair East bus stand", "sequence": 1 },
  "eta_seconds": 280,
  "position": { "lat": 13.08, "lng": 80.19, "speed": 28, "heading": 90, "recorded_at": "2026-11-09T07:12:30.000+05:30", "source": "device" },
  "end_reason": null
}
```

| `type` | `stop` | `eta_seconds` | Delivery |
|---|---|---|---|
| `trip.started` | null | null | queued |
| `trip.position` | null | ETA to the next stop (pickup: to the destination once every stop is done) | at most one per 2 s per trip, latest wins, never retried, `id` 0 |
| `stop.approaching` | the stop | ETA to that stop | queued |
| `stop.arrived` | the stop | 0 | queued |
| `stop.departed` | the stop | null | queued |
| `trip.ended` | null | null; `end_reason` set | queued |

`id` is the `trip_events` id, so receivers can drop duplicates. `at` is when it happened (the GPS time for engine events). Queued events go out in order per trip with a 5 s timeout and up to 3 retries after 1 s, 5 s and 15 s; any 2xx counts as delivered. Attempts, status and the last error are kept on the `trip_events` row. Delivery runs in the background and never slows MQTT ingest; deliveries still queued when the service stops are not resent (their rows stay `pending`).

Verify the signature over the raw bytes before parsing, with a constant-time compare:

```js
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
const ok = header.length === expected.length && crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
```

### Device events: `alert.raised` and `vehicle.fault`

Two more event types go through the same webhook URL, secret, headers, signature and retries. They are queued per device instead of per trip, and their delivery is kept on the `safety_events` / `vehicle_faults` row. `id` is that row's id, so receivers can drop duplicates.

```json
{ "id": 31, "type": "alert.raised", "at": "2026-11-09T07:12:30.000+05:30",
  "trip": { "id": 7, "ref": "TZMS-41", "device_id": 1, "kind": "pickup" }, "device_id": 1,
  "alert": { "kind": "overspeed", "severity": "high", "message": "Overspeed: 72 km/h for 15 s (limit 50 km/h)",
             "value": 72, "limit": 50, "position": { "lat": 13.08, "lng": 80.19, "speed_kmh": 72 } } }
```

`trip` is `null` outside a trip; `value`, `limit` and `position.speed_kmh` are left out when unknown.

```json
{ "id": 12, "type": "vehicle.fault", "at": "2026-11-09T07:12:30.000+05:30", "device_id": 1,
  "fault": { "code": "P0217", "description": "Engine coolant over temperature", "severity": "high" }, "odometer_km": 48213.7 }
```

`odometer_km` is left out when the OBD reading had none.

### Phone GPS fallback: `POST /devices/{id}/positions`

For a bus whose tracker is down, the product API can forward the driver's phone GPS. The body is the GPS payload (`{ "ts": 1793600000, "lat": 13.0846, "lng": 80.1767, "spd": 28, "hdg": 90, "ign": 1 }`), validated like MQTT. It goes through the same ingest (stored with `source = phone`, live status updated, trip engine run) and returns `202`:

```json
{ "accepted": true, "reason": null, "trip_id": 7 }
```

If the tracker itself sent GPS in the last 60 seconds the point is ignored: `accepted: false, reason: "device_gps_recent"`. A deactivated device returns `409 DEVICE_INACTIVE`.

## Safety rules

Every accepted GPS point (tracker or phone) is checked, in order per device, by `modules/safety/safety-rules.ts` (pure). A finding is stored in `safety_events` and sent as `alert.raised`.

| Kind | When | Severity |
|---|---|---|
| `overspeed` | Speed above the limit (device `speed_limit_kmh`, else `SAFETY_SPEED_LIMIT_KMH`, default 50) for `SAFETY_OVERSPEED_SECONDS` (10). Once per episode; `value` is the peak | `high` at 20 km/h over the limit, else `medium` |
| `harsh_braking` | Speed falls by `SAFETY_HARSH_BRAKE_KMH_PER_S` (12) or more per second between two points at most 10 s apart, from 20 km/h or more; or the tracker sends `evt: harsh_brake`. `value` is km/h lost per second | `high` at 1.5 × the threshold, else `medium` |
| `idle` | During a trip, engine not off and speed 3 km/h or less for `SAFETY_IDLE_MINUTES` (5). Once per stop; `value` is minutes | `medium` at 3 × the limit, else `low` |
| `route_deviation` | During a trip, farther than `SAFETY_ROUTE_DEVIATION_M` (300) from the planned path for `SAFETY_ROUTE_DEVIATION_SECONDS` (30). The path is the stops in travel order joined to the destination (pickup: stops then school; drop: school then stops). A pickup is checked only after it reaches its first stop. `value` is the farthest distance in metres | `high` at 2 × the limit, else `medium` |

The same kind is raised at most once per device every `SAFETY_COOLDOWN_SECONDS` (300). Points older than the last checked point are ignored.

## Vehicle health and faults

Each OBD message with a `dtc` list is compared with the device's open faults (`vehicle_faults`): a new code opens a row and sends `vehicle.fault` once; a code no longer reported is closed (`cleared_at`). Descriptions and severities come from `DTC_CATALOG` in `modules/obd/obd-faults.ts` (unknown codes: P and U medium, C high, B low).

`GET /devices/{id}/health` status:

| Status | When |
|---|---|
| `critical` | A `high` fault, coolant above 105 °C or battery below 11.5 V |
| `warning` | Any other fault, coolant above 100 °C, battery below 12 V, fuel below 15%, or the last OBD reading is more than a day old |
| `good` | None of these |
| `unknown` | No OBD reading yet |

Faults count only from a reading in the last 24 hours. `reasons` lists what lowered the status.

## Trip playback

`GET /trips/{id}/playback?max_points=1500` (50–5000) returns `trip` (TripState), `path` (planned route), `points` `[{ at, lat, lng, speed, heading }]` oldest first, `total_points`, `sampled`, `distance_km`, `duration_seconds`, `max_speed`, `avg_speed` (distance ÷ duration), `stop_arrivals` (each stop with `status`, `arrived_at`, `departed_at`) and `safety_events`. Long tracks are thinned evenly to `max_points`, keeping the first and last point; distance and speeds use every stored point. It works on an active trip too (the track so far).

## GPS log and TimescaleDB

The `telemetry` table is the GPS log: one row per point, with `source` (`device`, `phone`, or null for rows stored before trips existed) and `trip_id` (the active trip when the point arrived). Indexes: `IDX_telemetry_device_recorded (device_id, recorded_at DESC)` for the latest position and history, `IDX_telemetry_trip (trip_id, recorded_at) WHERE trip_id IS NOT NULL` for trip playback, and the partial harsh-event index.

The table is plain PostgreSQL today. To turn it into a TimescaleDB hypertable later (in a migration, during a quiet window):

1. Install the extension: `CREATE EXTENSION IF NOT EXISTS timescaledb;`
2. Every unique index on a hypertable must include the time column, so the primary key on `id` alone blocks the conversion. Replace it: `ALTER TABLE telemetry DROP CONSTRAINT "PK_telemetry"; ALTER TABLE telemetry ADD CONSTRAINT "PK_telemetry" PRIMARY KEY (id, recorded_at);` and make `recorded_at` part of the entity's primary key (`@PrimaryColumn` next to the generated `id`).
3. Convert, keeping the data: `SELECT create_hypertable('telemetry', 'recorded_at', chunk_time_interval => INTERVAL '1 day', migrate_data => true);`
4. Optional: compression (`ALTER TABLE telemetry SET (timescaledb.compress, timescaledb.compress_segmentby = 'device_id'); SELECT add_compression_policy('telemetry', INTERVAL '7 days');`) and retention (`SELECT add_retention_policy('telemetry', INTERVAL '180 days');`).

The foreign key from `telemetry.device_id` to `devices` is allowed on a hypertable; `trip_id` has no foreign key on purpose. The same steps apply to `obd_readings`.

## Simulators

All of them publish to `MQTT_URL` from `.env` unless told otherwise. Register the IMEIs with `POST /devices` first, or the service drops their messages.

**Drive a trip** (`npm run sim:trip`): reads a trip over REST (`GET /trips/{id}` with the first key in `API_KEYS`), then drives the trip's device through it on `fleet/{imei}/gps`, with OBD on `fleet/{imei}/obd`. A pickup starts about 1.5 km before the first stop, dwells 20–40 s inside every stop and parks at the destination; a drop starts at the destination, visits the stops and drives 400 m past the last one. It prints stop status changes and exits once the trip has ended, so it produces the whole event sequence: `stop.approaching`, `stop.arrived` and `stop.departed` for each stop, then `trip.ended`.

```bash
npm run sim:trip -- --trip 7
npm run sim:trip -- --trip 7 --interval 2 --time-scale 3 --broker mqtt://localhost:1883 --quiet
```

| Flag | Default | Meaning |
|---|---|---|
| `--trip` | required | Trip id from `POST /trips` (must be active) |
| `--interval` | `2` | Seconds between GPS messages |
| `--time-scale` | `1` | Simulated seconds per real second |
| `--obd-every` | `5` | Publish OBD every n GPS messages |
| `--broker` | `MQTT_URL` | Broker URL |
| `--api` | `http://localhost:PORT/api/v1` | This service's base URL |
| `--quiet` | | Do not print every GPS message |

Stops are joined by straight lines, so the bus drives across the map rather than along roads.

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
| `sim:trip -- --trip <id> [flags]` | Drive the device of a trip through its stops to produce the trip events |

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
    telemetry/            GPS ingest (fleet/+/gps and telematics/+/telemetry), phone fallback, position history
    obd/                  OBD ingest (fleet/+/obd), OBD history, fault codes, vehicle health, vehicle.fault
    trips/                trips API, trip engine (trip-engine.ts, pure), playback, webhook delivery and signing
    safety/               safety rules (safety-rules.ts, pure), safety_events, alert.raised
    mqtt/                 broker connection status, topic filters, payload parser
    health/               /api/health
  tools/simulate-bus.ts   fake tracker for demos (original topic)
  tools/simulate-route.ts route simulator CLI (bus-model.ts, route-math.ts, chennai-routes.ts)
  tools/simulate-trip.ts  trip simulator CLI (trip-route.ts builds the path from a trip)
mosquitto/                local broker config
```
