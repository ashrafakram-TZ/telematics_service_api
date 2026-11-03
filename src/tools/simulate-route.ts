import 'dotenv/config';
import { connect } from 'mqtt';
import { SimulatedBus } from './bus-model';
import { CHENNAI_ROUTES, RecordedRoute } from './chennai-routes';

interface Options {
  routes: RecordedRoute[];
  vehicles: string[];
  interval: number;
  timeScale: number;
  obdEvery: number;
  duration: number;
  broker: string;
  faults: Set<string>;
  quiet: boolean;
}

const USAGE = `Usage: npm run sim:route -- [options]
  --route <id|all>        ${CHENNAI_ROUTES.map((route) => route.id).join(', ')} or all (default all, one route per bus in turn)
  --vehicles <imei,...>   tracker IMEIs registered in /devices (default 860000000000001)
  --interval <seconds>    seconds between messages per bus (default 2)
  --time-scale <n>        simulated seconds per real second, to drive faster (default 1)
  --obd-every <n>         publish OBD every n GPS messages (default 1)
  --duration <seconds>    stop after this many seconds (default 0 = until Ctrl+C)
  --broker <url>          MQTT broker (default MQTT_URL from .env)
  --faults <imei,...>     these buses overheat and report DTC P0217 after a minute
  --quiet                 do not print every message
  --list                  print the recorded routes and exit`;

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
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`--${name} must be a non-negative number`);
  return parsed;
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptions(argv: string[]): Options | null {
  const map = flags(argv);
  if (map.has('help')) {
    console.log(USAGE);
    return null;
  }
  if (map.has('list')) {
    for (const route of CHENNAI_ROUTES) {
      console.log(`${route.id.padEnd(20)} ${route.points.length} points  ${route.name}`);
      console.log(`${''.padEnd(20)} stops: ${route.stops.map((stop) => stop.name).join(' > ')}`);
    }
    return null;
  }
  const routeId = map.get('route') ?? 'all';
  const routes = routeId === 'all' ? CHENNAI_ROUTES : CHENNAI_ROUTES.filter((route) => route.id === routeId);
  if (!routes.length) throw new Error(`Unknown route ${routeId}. Use --list to see the routes.`);
  const vehicles = list(map.get('vehicles') ?? map.get('vehicle'));
  const invalid = vehicles.find((imei) => !/^\d{15}$/.test(imei));
  if (invalid) throw new Error(`${invalid} is not a 15-digit IMEI`);
  const broker = map.get('broker') ?? process.env.MQTT_URL;
  if (!broker) throw new Error('Set MQTT_URL in .env or pass --broker mqtt://host:1883');
  return {
    routes,
    vehicles: vehicles.length ? vehicles : ['860000000000001'],
    interval: Math.max(0.5, positive(map.get('interval'), 2, 'interval')),
    timeScale: Math.max(1, positive(map.get('time-scale'), 1, 'time-scale')),
    obdEvery: Math.max(1, Math.round(positive(map.get('obd-every'), 1, 'obd-every'))),
    duration: positive(map.get('duration'), 0, 'duration'),
    broker,
    faults: new Set(list(map.get('faults'))),
    quiet: map.has('quiet'),
  };
}

const topicFor = (filter: string, imei: string) => filter.replace('+', imei);

function run(options: Options): void {
  const gpsTopic = process.env.MQTT_GPS_TOPIC || 'fleet/+/gps';
  const obdTopic = process.env.MQTT_OBD_TOPIC || 'fleet/+/obd';
  const sameRouteCount = new Map<string, number>();
  const buses = options.vehicles.map((imei, i) => {
    const route = options.routes[i % options.routes.length];
    const onRoute = options.vehicles.filter((_, j) => options.routes[j % options.routes.length].id === route.id).length;
    const slot = sameRouteCount.get(route.id) ?? 0;
    sameRouteCount.set(route.id, slot + 1);
    return new SimulatedBus(imei, route, { startFraction: slot / onRoute, faults: options.faults.has(imei) });
  });

  const client = connect(options.broker, {
    clientId: `route-simulator-${Date.now()}`,
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 5000,
  });
  let sent = 0;
  let timer: NodeJS.Timeout | undefined;

  const stop = () => {
    if (timer) clearInterval(timer);
    console.log(`Published ${sent} messages. Bye.`);
    client.end(false, {}, () => process.exit(0));
  };

  client.on('connect', () => {
    if (timer) return;
    console.log(
      `Connected to ${options.broker}. Every ${options.interval}s, time x${options.timeScale}. Ctrl+C to stop.`,
    );
    for (const bus of buses) {
      console.log(
        `  ${bus.imei} on ${bus.route.id} -> ${topicFor(gpsTopic, bus.imei)}, ${topicFor(obdTopic, bus.imei)}`,
      );
    }
    let tick = 0;
    timer = setInterval(() => {
      const now = new Date();
      for (const bus of buses) {
        bus.advance(options.interval * options.timeScale);
        const gps = bus.gps(now);
        client.publish(topicFor(gpsTopic, bus.imei), JSON.stringify(gps));
        sent += 1;
        if (!options.quiet) console.log(`${bus.imei} gps ${JSON.stringify(gps)}`);
        if (tick % options.obdEvery === 0) {
          const obd = bus.obd(now);
          client.publish(topicFor(obdTopic, bus.imei), JSON.stringify(obd));
          sent += 1;
          if (!options.quiet) console.log(`${bus.imei} obd ${JSON.stringify(obd)}`);
        }
      }
      tick += 1;
    }, options.interval * 1000);
    if (options.duration) setTimeout(stop, options.duration * 1000);
  });
  client.on('error', (error) => console.error(error.message));
  process.on('SIGINT', stop);
}

try {
  const options = parseOptions(process.argv.slice(2));
  if (options) run(options);
} catch (error) {
  console.error((error as Error).message);
  console.error(USAGE);
  process.exit(1);
}
