import { haversineMeters } from '../../common/utils/geo';

export const DEFAULT_PLAYBACK_POINTS = 1500;
export const MAX_PLAYBACK_POINTS = 5000;

export interface TrackPoint {
  at: Date;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
}

export interface TrackStats {
  distance_km: number;
  duration_seconds: number;
  max_speed: number | null;
  avg_speed: number | null;
}

export function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  if (max < 2) return [points[0]];
  const step = (points.length - 1) / (max - 1);
  const picked: T[] = [];
  let last = -1;
  for (let slot = 0; slot < max; slot += 1) {
    const index = Math.round(slot * step);
    if (index !== last) picked.push(points[index]);
    last = index;
  }
  return picked;
}

export function trackStats(points: TrackPoint[]): TrackStats {
  if (!points.length) return { distance_km: 0, duration_seconds: 0, max_speed: null, avg_speed: null };
  let metres = 0;
  for (let index = 1; index < points.length; index += 1) metres += haversineMeters(points[index - 1], points[index]);
  const seconds = Math.max(0, Math.round((points[points.length - 1].at.getTime() - points[0].at.getTime()) / 1000));
  const speeds = points.map((point) => point.speed).filter((speed): speed is number => speed !== null);
  const km = Math.round(metres / 10) / 100;
  return {
    distance_km: km,
    duration_seconds: seconds,
    max_speed: speeds.length ? Math.round(Math.max(...speeds) * 10) / 10 : null,
    avg_speed: seconds > 0 ? Math.round((km / (seconds / 3600)) * 10) / 10 : null,
  };
}
