export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

const METRES_PER_DEGREE = 111320;

export function distanceToPathMeters(point: GeoPoint, path: GeoPoint[]): number {
  if (!path.length) return Infinity;
  if (path.length === 1) return haversineMeters(point, path[0]);
  const scaleX = METRES_PER_DEGREE * Math.cos(rad(point.lat));
  const project = (p: GeoPoint) => ({ x: (p.lng - point.lng) * scaleX, y: (p.lat - point.lat) * METRES_PER_DEGREE });
  let best = Infinity;
  for (let index = 1; index < path.length; index += 1) {
    const a = project(path[index - 1]);
    const b = project(path[index]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared)) : 0;
    best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return best;
}
