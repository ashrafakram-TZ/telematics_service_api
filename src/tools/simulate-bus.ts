import 'dotenv/config';
import { connect } from 'mqtt';

const imei = process.argv[2] ?? '860000000000001';
const seconds = Number(process.argv[3] ?? 5);
const url = process.env.MQTT_URL ?? 'mqtt://broker.hivemq.com:1883';
const route: [number, number][] = [
  [13.0878, 80.2101],
  [13.085, 80.2125],
  [13.0821, 80.2152],
  [13.0796, 80.2183],
  [13.0768, 80.2214],
  [13.0741, 80.2246],
];

const client = connect(url, { clientId: `bus-simulator-${imei}-${Date.now()}` });
let step = 0;

client.on('connect', () => {
  console.log(`Publishing to telematics/${imei}/telemetry on ${url} every ${seconds}s. Ctrl+C to stop.`);
  setInterval(() => {
    const [lat, lng] = route[step % route.length];
    const payload = {
      ts: Math.floor(Date.now() / 1000),
      lat,
      lng,
      spd: step % route.length === 0 ? 0 : 28 + (step % 7),
      hdg: 135,
      ign: 1,
      odo: 12045 + step * 0.4,
      fuel: Math.max(10, 80 - step),
      bat: Math.max(15, 95 - Math.floor(step / 4)),
      volt: Number((12.8 - step * 0.01).toFixed(2)),
      ...(step % 9 === 4 ? { evt: 'harsh_brake' } : step % 13 === 7 ? { evt: 'harsh_accel' } : {}),
    };
    client.publish(`telematics/${imei}/telemetry`, JSON.stringify(payload));
    console.log(JSON.stringify(payload));
    step += 1;
  }, seconds * 1000);
});
client.on('error', (error) => console.error(error.message));
