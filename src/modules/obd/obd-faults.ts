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

export const FAULT_SEVERITIES = ['low', 'medium', 'high'] as const;
export type FaultSeverity = (typeof FAULT_SEVERITIES)[number];

export const HEALTH_STATUSES = ['good', 'warning', 'critical', 'unknown'] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export const COOLANT_WARNING_C = 100;
export const BATTERY_WARNING_V = 12.0;
export const BATTERY_CRITICAL_V = 11.5;
export const FUEL_WARNING_PCT = 15;

export interface DtcInfo {
  description: string;
  severity: FaultSeverity;
}

export const DTC_CATALOG: Record<string, DtcInfo> = {
  P0087: { description: 'Fuel rail pressure too low', severity: 'high' },
  P0101: { description: 'Mass air flow sensor range or performance', severity: 'medium' },
  P0115: { description: 'Engine coolant temperature sensor circuit', severity: 'medium' },
  P0117: { description: 'Engine coolant temperature sensor low', severity: 'medium' },
  P0118: { description: 'Engine coolant temperature sensor high', severity: 'medium' },
  P0128: { description: 'Coolant thermostat below regulating temperature', severity: 'low' },
  P0171: { description: 'Fuel system too lean (bank 1)', severity: 'medium' },
  P0172: { description: 'Fuel system too rich (bank 1)', severity: 'medium' },
  P0217: { description: 'Engine coolant over temperature', severity: 'high' },
  P0219: { description: 'Engine overspeed condition', severity: 'high' },
  P0234: { description: 'Turbocharger overboost', severity: 'high' },
  P0299: { description: 'Turbocharger underboost', severity: 'medium' },
  P0300: { description: 'Random or multiple cylinder misfire', severity: 'high' },
  P0301: { description: 'Cylinder 1 misfire', severity: 'high' },
  P0302: { description: 'Cylinder 2 misfire', severity: 'high' },
  P0303: { description: 'Cylinder 3 misfire', severity: 'high' },
  P0304: { description: 'Cylinder 4 misfire', severity: 'high' },
  P0335: { description: 'Crankshaft position sensor circuit', severity: 'high' },
  P0380: { description: 'Glow plug circuit', severity: 'medium' },
  P0401: { description: 'Exhaust gas recirculation flow too low', severity: 'low' },
  P0420: { description: 'Catalyst efficiency below threshold', severity: 'low' },
  P0480: { description: 'Cooling fan relay circuit', severity: 'medium' },
  P0500: { description: 'Vehicle speed sensor', severity: 'medium' },
  P0520: { description: 'Engine oil pressure sensor circuit', severity: 'high' },
  P0524: { description: 'Engine oil pressure too low', severity: 'high' },
  P0562: { description: 'System voltage low', severity: 'medium' },
  P0563: { description: 'System voltage high', severity: 'medium' },
  P0571: { description: 'Brake switch circuit', severity: 'high' },
  P0700: { description: 'Transmission control system malfunction', severity: 'medium' },
  C0035: { description: 'Left front wheel speed sensor (ABS)', severity: 'high' },
  C0040: { description: 'Right front wheel speed sensor (ABS)', severity: 'high' },
  C0265: { description: 'ABS motor relay circuit', severity: 'high' },
  B0001: { description: 'Driver frontal airbag deployment control', severity: 'medium' },
  B1000: { description: 'Body control module internal fault', severity: 'low' },
  U0001: { description: 'High speed CAN communication bus', severity: 'medium' },
  U0100: { description: 'Lost communication with engine control module', severity: 'high' },
  U0121: { description: 'Lost communication with ABS control module', severity: 'high' },
};

const SYSTEM_NAMES: Record<string, string> = { P: 'Powertrain', C: 'Chassis', B: 'Body', U: 'Network' };
const SYSTEM_SEVERITY: Record<string, FaultSeverity> = { P: 'medium', C: 'high', B: 'low', U: 'medium' };

export function describeDtc(code: string): DtcInfo {
  const known = DTC_CATALOG[code];
  if (known) return known;
  const system = code.charAt(0);
  return {
    description: `${SYSTEM_NAMES[system] ?? 'Vehicle'} fault ${code}`,
    severity: SYSTEM_SEVERITY[system] ?? 'medium',
  };
}

export function newFaultCodes(current: string[], open: string[]): string[] {
  const known = new Set(open);
  return [...new Set(current)].filter((code) => !known.has(code));
}

export function clearedFaultCodes(current: string[], open: string[]): string[] {
  const active = new Set(current);
  return open.filter((code) => !active.has(code));
}

export interface HealthInput {
  at: Date;
  battery_v: number | null;
  coolant_c: number | null;
  fuel_pct: number | null;
  dtc: string[];
}

export interface HealthVerdict {
  status: HealthStatus;
  reasons: string[];
}

export function vehicleHealth(reading: HealthInput | null, now: Date): HealthVerdict {
  if (!reading) return { status: 'unknown', reasons: ['No OBD data received yet'] };
  const critical: string[] = [];
  const warning: string[] = [];
  const fresh = now.getTime() - reading.at.getTime() <= DTC_STALE_HOURS * 3600 * 1000;
  if (fresh) {
    for (const code of [...new Set(reading.dtc)]) {
      const info = describeDtc(code);
      (info.severity === 'high' ? critical : warning).push(`Fault ${code}: ${info.description}`);
    }
  }
  if (reading.coolant_c !== null && reading.coolant_c > COOLANT_OVERHEAT_C) {
    critical.push(`Coolant ${reading.coolant_c} °C (overheating)`);
  } else if (reading.coolant_c !== null && reading.coolant_c > COOLANT_WARNING_C) {
    warning.push(`Coolant ${reading.coolant_c} °C (running hot)`);
  }
  if (reading.battery_v !== null && reading.battery_v < BATTERY_CRITICAL_V) {
    critical.push(`Battery ${reading.battery_v} V (very low)`);
  } else if (reading.battery_v !== null && reading.battery_v < BATTERY_WARNING_V) {
    warning.push(`Battery ${reading.battery_v} V (low)`);
  }
  if (reading.fuel_pct !== null && reading.fuel_pct < FUEL_WARNING_PCT) warning.push(`Fuel ${reading.fuel_pct}% (low)`);
  if (!fresh) warning.push('Last OBD reading is more than a day old');
  if (critical.length) return { status: 'critical', reasons: [...critical, ...warning] };
  if (warning.length) return { status: 'warning', reasons: warning };
  return { status: 'good', reasons: [] };
}
