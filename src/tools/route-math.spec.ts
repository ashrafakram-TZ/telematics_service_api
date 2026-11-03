import { parsePayload } from '../modules/mqtt/payload-parser';
import { ObdPayloadDto } from '../modules/obd/dto/obd-payload.dto';
import { TelemetryPayloadDto } from '../modules/telemetry/dto/telemetry-payload.dto';
import { SimulatedBus } from './bus-model';
import { CHENNAI_ROUTES } from './chennai-routes';
import { bearing, buildPath, distanceMeters, LatLng, positionAt } from './route-math';

describe('route interpolation', () => {
  const south: LatLng = [13.0, 80.2];
  const north: LatLng = [13.01, 80.2];
  const east: LatLng = [13.01, 80.21];

  it('measures distance and heading', () => {
    expect(distanceMeters(south, north)).toBeCloseTo(1112, -1);
    expect(bearing(south, north)).toBe(0);
    expect(bearing(north, south)).toBe(180);
    expect(bearing(north, east)).toBe(90);
  });

  it('interpolates between points along the path', () => {
    const path = buildPath([south, north, east]);
    const half = positionAt(path, distanceMeters(south, north) / 2);
    expect(half.lat).toBeCloseTo(13.005, 5);
    expect(half.lng).toBeCloseTo(80.2, 5);
    expect(half.heading).toBe(0);
    const onSecond = positionAt(path, distanceMeters(south, north) + 100);
    expect(onSecond.segment).toBe(1);
    expect(onSecond.heading).toBe(90);
    expect(onSecond.lat).toBeCloseTo(13.01, 5);
  });

  it('clamps before the start and after the end', () => {
    const path = buildPath([south, north]);
    expect(positionAt(path, -50)).toEqual(expect.objectContaining({ lat: 13, lng: 80.2 }));
    expect(positionAt(path, path.length + 500)).toEqual(expect.objectContaining({ lat: 13.01, lng: 80.2 }));
  });

  it('needs at least two points', () => {
    expect(() => buildPath([south])).toThrow();
  });
});

describe('recorded Chennai routes', () => {
  it.each(CHENNAI_ROUTES.map((route) => [route.id, route]))('%s is dense and stays in Chennai', (_, route) => {
    expect(route.points.length).toBeGreaterThanOrEqual(30);
    for (const [lat, lng] of route.points) {
      expect(lat).toBeGreaterThan(12.85);
      expect(lat).toBeLessThan(13.2);
      expect(lng).toBeGreaterThan(80.1);
      expect(lng).toBeLessThan(80.3);
    }
    for (let i = 1; i < route.points.length; i += 1) {
      expect(distanceMeters(route.points[i - 1], route.points[i])).toBeLessThan(300);
    }
    expect(route.stops[0].index).toBe(0);
    expect(route.stops[route.stops.length - 1].index).toBe(route.points.length - 1);
  });
});

describe('simulated bus', () => {
  it('drives the route and publishes payloads the service accepts', () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const bus = new SimulatedBus('860000000000001', CHENNAI_ROUTES[0], { random, fuel: 70, faults: true });
    const states = new Set<string>();
    const fuel: number[] = [];
    for (let i = 0; i < 300; i += 1) {
      bus.advance(4);
      states.add(bus.phase);
      const now = new Date();
      const gps = bus.gps(now);
      const obd = bus.obd(now);
      fuel.push(gps.fuel);
      expect(parsePayload(TelemetryPayloadDto, gps).ok).toBe(true);
      expect(parsePayload(ObdPayloadDto, obd).ok).toBe(true);
    }
    expect(states).toEqual(new Set(['cruise', 'dwell', 'parked']));
    expect(fuel[fuel.length - 1]).toBeLessThan(fuel[0]);
    expect(bus.obd(new Date()).dtc).toEqual(bus.phase === 'parked' ? [] : ['P0217']);
  });
});
