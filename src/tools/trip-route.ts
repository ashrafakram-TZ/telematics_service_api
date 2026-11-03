import { RecordedRoute } from './chennai-routes';
import { LatLng } from './route-math';

export interface SimTripStop {
  ref: string;
  name: string;
  sequence: number;
  lat: number;
  lng: number;
}

export interface SimTrip {
  id: number;
  ref: string;
  kind: 'pickup' | 'drop';
  stops: SimTripStop[];
  destination: { name: string; lat: number; lng: number };
}

export const LEAD_IN_M = 1500;
export const DROP_TAIL_M = 400;

const METRES_PER_DEG_LAT = 110540;
const metresPerDegLng = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

export function offsetPoint(from: LatLng, toward: LatLng, metres: number): LatLng {
  const dx = (toward[1] - from[1]) * metresPerDegLng(from[0]);
  const dy = (toward[0] - from[0]) * METRES_PER_DEG_LAT;
  const length = Math.hypot(dx, dy);
  const [ux, uy] = length < 1 ? [1, 0] : [dx / length, dy / length];
  return [
    Number((from[0] + (uy * metres) / METRES_PER_DEG_LAT).toFixed(6)),
    Number((from[1] + (ux * metres) / metresPerDegLng(from[0])).toFixed(6)),
  ];
}

export function tripRoute(trip: SimTrip): RecordedRoute {
  const stops = [...trip.stops].sort((a, b) => a.sequence - b.sequence);
  const stopPoints: LatLng[] = stops.map((stop) => [stop.lat, stop.lng]);
  const school: LatLng = [trip.destination.lat, trip.destination.lng];
  const named = stops.map((stop, i) => ({ index: i + 1, name: stop.name }));

  if (trip.kind === 'pickup') {
    const first = stopPoints[0];
    const ahead = stopPoints[1] ?? school;
    const start = offsetPoint(first, ahead, -LEAD_IN_M);
    return {
      id: `trip-${trip.id}`,
      name: `${trip.ref} pickup`,
      points: [start, ...stopPoints, school],
      stops: named,
    };
  }

  const last = stopPoints[stopPoints.length - 1];
  const before = stopPoints[stopPoints.length - 2] ?? school;
  const tail = offsetPoint(last, before, -DROP_TAIL_M);
  return {
    id: `trip-${trip.id}`,
    name: `${trip.ref} drop`,
    points: [school, ...stopPoints, tail],
    stops: named,
  };
}
