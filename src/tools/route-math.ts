export type LatLng = [number, number];

export interface RoutePath {
  points: LatLng[];
  cumulative: number[];
  length: number;
}

export interface PathPosition {
  lat: number;
  lng: number;
  heading: number;
  segment: number;
}

const EARTH_RADIUS_M = 6371000;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function distanceMeters([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function bearing([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const y = Math.sin(rad(lng2 - lng1)) * Math.cos(rad(lat2));
  const x =
    Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lng2 - lng1));
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((degrees + 360) % 360) % 360;
}

export function buildPath(points: LatLng[]): RoutePath {
  if (points.length < 2) throw new Error('A route needs at least two points');
  const cumulative = [0];
  for (let i = 1; i < points.length; i += 1) {
    cumulative.push(cumulative[i - 1] + distanceMeters(points[i - 1], points[i]));
  }
  return { points, cumulative, length: cumulative[cumulative.length - 1] };
}

export function reversePath(path: RoutePath): RoutePath {
  return buildPath([...path.points].reverse());
}

export function positionAt(path: RoutePath, meters: number): PathPosition {
  const clamped = Math.min(Math.max(meters, 0), path.length);
  let segment = 0;
  while (segment < path.points.length - 2 && path.cumulative[segment + 1] < clamped) segment += 1;
  const start = path.points[segment];
  const end = path.points[segment + 1];
  const span = path.cumulative[segment + 1] - path.cumulative[segment];
  const t = span === 0 ? 0 : (clamped - path.cumulative[segment]) / span;
  return {
    lat: Number((start[0] + (end[0] - start[0]) * t).toFixed(6)),
    lng: Number((start[1] + (end[1] - start[1]) * t).toFixed(6)),
    heading: bearing(start, end),
    segment,
  };
}

export function distanceToNext(path: RoutePath, meters: number, indices: number[]): number | null {
  const ahead = indices.map((index) => path.cumulative[index] - meters).filter((gap) => gap > 0.5);
  return ahead.length ? Math.min(...ahead) : null;
}
