import { DeviceStatusDto } from './dto/device-status.dto';

export function deviceState(
  lastSeen: Date | null,
  speed: number | null,
  now: Date,
  onlineWindowSeconds: number,
): { state: DeviceStatusDto['state']; online: boolean } {
  if (!lastSeen) return { state: 'no_data', online: false };
  const online = now.getTime() - lastSeen.getTime() <= onlineWindowSeconds * 1000;
  if (!online) return { state: 'offline', online };
  return { state: (speed ?? 0) > 2 ? 'moving' : 'idle', online };
}
