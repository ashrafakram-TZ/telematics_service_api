import { VehicleAlert } from '../devices/dto/device-status.dto';

export const COOLANT_OVERHEAT_C = 105;
export const DTC_STALE_HOURS = 24;

export interface ObdFaultInput {
  coolant_c: number | null;
  dtc: string[];
  at: Date;
}

export function obdAlerts(obd: ObdFaultInput | null, now: Date, onlineWindowSeconds: number): VehicleAlert[] {
  if (!obd) return [];
  const age = now.getTime() - obd.at.getTime();
  const alerts: VehicleAlert[] = [];
  if (obd.dtc.length && age <= DTC_STALE_HOURS * 3600 * 1000) alerts.push('engine_fault');
  if (obd.coolant_c !== null && obd.coolant_c > COOLANT_OVERHEAT_C && age <= onlineWindowSeconds * 1000) {
    alerts.push('engine_overheat');
  }
  return alerts;
}
