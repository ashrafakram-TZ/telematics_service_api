import { VehicleFault } from './entities/vehicle-fault.entity';
import { clearedFaultCodes, describeDtc, newFaultCodes, vehicleHealth } from './obd-faults';
import { faultWebhookBody } from './obd.service';

const now = new Date('2026-11-09T02:00:00.000Z');
const reading = (extra: Partial<Parameters<typeof vehicleHealth>[0] & object> = {}) => ({
  at: new Date(now.getTime() - 60 * 1000),
  battery_v: 13.9,
  coolant_c: 89,
  fuel_pct: 60,
  dtc: [] as string[],
  ...extra,
});

describe('fault codes', () => {
  it('describes known codes and falls back by system letter', () => {
    expect(describeDtc('P0217')).toEqual({ description: 'Engine coolant over temperature', severity: 'high' });
    expect(describeDtc('P0420').severity).toBe('low');
    expect(describeDtc('P1234')).toEqual({ description: 'Powertrain fault P1234', severity: 'medium' });
    expect(describeDtc('C1234').severity).toBe('high');
    expect(describeDtc('B1234').severity).toBe('low');
  });

  it('finds codes that are new and codes that cleared', () => {
    expect(newFaultCodes(['P0301', 'P0217', 'P0301'], ['P0301'])).toEqual(['P0217']);
    expect(newFaultCodes([], ['P0301'])).toEqual([]);
    expect(clearedFaultCodes(['P0217'], ['P0301', 'P0217'])).toEqual(['P0301']);
  });
});

describe('vehicle health', () => {
  it('is unknown without OBD and good when every reading is normal', () => {
    expect(vehicleHealth(null, now)).toEqual({ status: 'unknown', reasons: ['No OBD data received yet'] });
    expect(vehicleHealth(reading(), now)).toEqual({ status: 'good', reasons: [] });
  });

  it('warns for minor faults, a hot engine, a weak battery and low fuel', () => {
    const verdict = vehicleHealth(reading({ dtc: ['P0420'], coolant_c: 102, battery_v: 11.8, fuel_pct: 10 }), now);
    expect(verdict.status).toBe('warning');
    expect(verdict.reasons).toEqual([
      'Fault P0420: Catalyst efficiency below threshold',
      'Coolant 102 °C (running hot)',
      'Battery 11.8 V (low)',
      'Fuel 10% (low)',
    ]);
  });

  it('is critical for a high-severity fault, overheating or a flat battery', () => {
    expect(vehicleHealth(reading({ dtc: ['P0217'] }), now).status).toBe('critical');
    expect(vehicleHealth(reading({ coolant_c: 108 }), now).reasons).toEqual(['Coolant 108 °C (overheating)']);
    expect(vehicleHealth(reading({ battery_v: 11.2 }), now).status).toBe('critical');
  });

  it('ignores fault codes from a reading older than a day and says so', () => {
    const old = reading({ dtc: ['P0217'], at: new Date(now.getTime() - 25 * 3600 * 1000) });
    expect(vehicleHealth(old, now)).toEqual({
      status: 'warning',
      reasons: ['Last OBD reading is more than a day old'],
    });
  });
});

describe('vehicle.fault webhook body', () => {
  it('matches the School API contract', () => {
    const fault = {
      id: 12,
      device_id: 1,
      code: 'P0217',
      description: 'Engine coolant over temperature',
      severity: 'high',
      odometer_km: 48213.7,
      first_seen_at: now,
    } as VehicleFault;
    expect(faultWebhookBody(fault)).toEqual({
      id: 12,
      type: 'vehicle.fault',
      at: now,
      device_id: 1,
      fault: { code: 'P0217', description: 'Engine coolant over temperature', severity: 'high' },
      odometer_km: 48213.7,
    });
    expect(faultWebhookBody({ ...fault, odometer_km: null })).not.toHaveProperty('odometer_km');
  });
});
