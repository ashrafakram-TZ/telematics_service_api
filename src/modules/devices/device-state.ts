import { DeviceStatusDto, VehicleAlert } from './dto/device-status.dto';

export const MOVING_KMPH = 2;
export const LOW_FUEL_PERCENT = 15;
export const LOW_BATTERY_PERCENT = 20;

export function deviceState(
  lastSeen: Date | null,
  speed: number | null,
  ignition: boolean | null,
  now: Date,
  onlineWindowSeconds: number,
): { state: DeviceStatusDto['state']; online: boolean } {
  if (!lastSeen) return { state: 'no_data', online: false };
  const online = now.getTime() - lastSeen.getTime() <= onlineWindowSeconds * 1000;
  if (!online) return { state: 'offline', online };
  if ((speed ?? 0) > MOVING_KMPH) return { state: 'moving', online };
  return { state: ignition === false ? 'parked' : 'idle', online };
}

export function vehicleAlerts(
  fuel: number | null,
  battery: number | null,
  harsh: { brake: number; accel: number; turn: number },
): VehicleAlert[] {
  const alerts: VehicleAlert[] = [];
  if (fuel !== null && fuel < LOW_FUEL_PERCENT) alerts.push('low_fuel');
  if (battery !== null && battery < LOW_BATTERY_PERCENT) alerts.push('low_battery');
  if (harsh.brake + harsh.accel + harsh.turn > 0) alerts.push('harsh_driving');
  return alerts;
}
