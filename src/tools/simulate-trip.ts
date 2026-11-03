import 'dotenv/config';
import { connect } from 'mqtt';
import { SimulatedBus } from './bus-model';
import { SimTrip, tripRoute } from './trip-route';

interface Options {
  tripId: number;
  interval: number;
  timeScale: number;
  obdEvery: number;
  broker: string;
  api: string;
  apiKey: string;
  quiet: boolean;
}

interface TripState extends SimTrip {
  device_id: number;
  status: 'active' | 'ended';
  end_reason: string | null;
  stops: (SimTrip['stops'][number] & { status: string; eta_seconds: number | null })[];
}

const USAGE = `Usage: npm run sim:trip -- --trip <id> [options]
  --trip <id>             trip id from POST /trips (required)
  --interval <seconds>    seconds between GPS messages (default 2)
  --time-scale <n>        simulated seconds per real second, to drive faster (default 1)
  --obd-every <n>         publish OBD every n GPS messages (default 5)
  --broker <url>          MQTT broker (default MQTT_URL from .env)
  --api <url>             this service's base URL (default http://localhost:PORT/api/v1)
  --quiet                 do not print every GPS message

Reads the trip over REST with the first key in API_KEYS, then drives the device of the trip:
pickup starts about 1.5 km before the first stop, dwells 20-40 s at every stop and parks at the destination;
drop starts at the destination, visits the stops and drives on past the last one.
Stops when the trip has ended.`;

function flags(argv: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const next = argv[i + 1];
    const hasValue = next !== undefined && !next.startsWith('--');
    map.set(arg.slice(2), hasValue ? next : 'true');
    if (hasValue) i += 1;
  }
  return map;
}

function positive(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive number`);
  return parsed;
}

function parseOptions(argv: string[]): Options | null {
  const map = flags(argv);
  if (map.has('help')) {
    console.log(USAGE);
    return null;
  }
  const tripId = Number(map.get('trip'));
  if (!Number.isInteger(tripId) || tripId < 1) throw new Error('--trip <id> is required');
  const broker = map.get('broker') ?? process.env.MQTT_URL;
  if (!broker) throw new Error('Set MQTT_URL in .env or pass --broker mqtt://host:1883');
  const apiKey = (process.env.API_KEYS ?? '').split(',')[0]?.trim();
  if (!apiKey) throw new Error('Set API_KEYS in .env');
  return {
    tripId,
    interval: Math.max(0.5, positive(map.get('interval'), 2, 'interval')),
    timeScale: Math.max(1, positive(map.get('time-scale'), 1, 'time-scale')),
    obdEvery: Math.max(1, Math.round(positive(map.get('obd-every'), 5, 'obd-every'))),
    broker,
    api: (map.get('api') ?? `http://localhost:${process.env.PORT ?? 3001}/api/v1`).replace(/\/$/, ''),
    apiKey,
    quiet: map.has('quiet'),
  };
}

async function getData<T>(options: Options, path: string): Promise<T> {
  const response = await fetch(`${options.api}${path}`, { headers: { 'X-Api-Key': options.apiKey } });
  const body = (await response.json()) as { data?: T; error?: string; message?: string };
  if (!response.ok) throw new Error(`GET ${path}: ${response.status} ${body.error ?? ''} ${body.message ?? ''}`);
  return body.data as T;
}

const clock = () => new Date().toISOString().slice(11, 23);
const topicFor = (filter: string, imei: string) => filter.replace('+', imei);

function describeStops(trip: TripState): string {
  return trip.stops.map((stop) => `${stop.ref}:${stop.status}`).join(' ');
}

async function run(options: Options): Promise<void> {
  const trip = await getData<TripState>(options, `/trips/${options.tripId}`);
  if (trip.status !== 'active') throw new Error(`Trip ${trip.id} has already ended (${trip.end_reason})`);
  const device = await getData<{ imei: string; name: string }>(options, `/devices/${trip.device_id}`);
  const route = tripRoute(trip);
  const bus = new SimulatedBus(device.imei, route, { startFraction: 0 });
  const gpsTopic = topicFor(process.env.MQTT_GPS_TOPIC || 'fleet/+/gps', device.imei);
  const obdTopic = topicFor(process.env.MQTT_OBD_TOPIC || 'fleet/+/obd', device.imei);

  console.log(`Trip ${trip.id} ${trip.ref} (${trip.kind}) on ${device.name} ${device.imei}`);
  console.log(`Route: ${route.points.map(([lat, lng]) => `${lat},${lng}`).join(' > ')}`);

  const client = connect(options.broker, {
    clientId: `trip-simulator-${Date.now()}`,
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 5000,
  });
  let timer: NodeJS.Timeout | undefined;
  let tick = 0;
  let parkedTicks = 0;
  let lastStops = describeStops(trip);

  const stop = (code = 0) => {
    if (timer) clearInterval(timer);
    client.end(false, {}, () => process.exit(code));
  };

  const poll = async () => {
    const state = await getData<TripState>(options, `/trips/${options.tripId}`);
    const stops = describeStops(state);
    if (stops !== lastStops) console.log(`${clock()} stops ${stops}`);
    lastStops = stops;
    if (state.status === 'ended') {
      console.log(`${clock()} trip ended: ${state.end_reason}. Published ${tick} GPS messages.`);
      stop();
    }
  };

  client.on('connect', () => {
    if (timer) return;
    console.log(
      `Connected to ${options.broker}. GPS ${gpsTopic} every ${options.interval}s, time x${options.timeScale}.`,
    );
    timer = setInterval(() => {
      const now = new Date();
      bus.advance(options.interval * options.timeScale);
      const gps = bus.gps(now);
      client.publish(gpsTopic, JSON.stringify(gps));
      if (!options.quiet) console.log(`${clock()} gps ${gps.lat},${gps.lng} ${gps.spd} km/h ${bus.phase}`);
      if (tick % options.obdEvery === 0) client.publish(obdTopic, JSON.stringify(bus.obd(now)));
      tick += 1;
      parkedTicks = bus.phase === 'parked' ? parkedTicks + 1 : 0;
      if (parkedTicks * options.interval * options.timeScale > 50) {
        console.error(`${clock()} parked at the end of the route but the trip is still active`);
        stop(1);
        return;
      }
      if (tick % 3 === 0) poll().catch((error: Error) => console.error(error.message));
    }, options.interval * 1000);
  });
  client.on('error', (error) => console.error(error.message));
  process.on('SIGINT', () => stop());
}

try {
  const options = parseOptions(process.argv.slice(2));
  if (options)
    run(options).catch((error: Error) => {
      console.error(error.message);
      process.exit(1);
    });
} catch (error) {
  console.error((error as Error).message);
  console.error(USAGE);
  process.exit(1);
}
