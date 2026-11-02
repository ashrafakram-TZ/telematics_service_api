import { matchesKey } from '../../common/auth/api-key.guard';
import { deviceState, vehicleAlerts } from './device-state';

describe('vehicle state', () => {
  const now = new Date('2026-11-02T08:00:00Z');

  it('has no data before the first position', () => {
    expect(deviceState(null, null, null, now, 120)).toEqual({ state: 'no_data', online: false });
  });

  it('is offline when the last report is older than the window', () => {
    expect(deviceState(new Date('2026-11-02T07:57:00Z'), 30, true, now, 120)).toEqual({
      state: 'offline',
      online: false,
    });
  });

  it('is moving above 2 km/h, idle with the engine on and parked with it off', () => {
    const recent = new Date('2026-11-02T07:59:30Z');
    expect(deviceState(recent, 30, true, now, 120)).toEqual({ state: 'moving', online: true });
    expect(deviceState(recent, 0, true, now, 120)).toEqual({ state: 'idle', online: true });
    expect(deviceState(recent, null, null, now, 120)).toEqual({ state: 'idle', online: true });
    expect(deviceState(recent, 0, false, now, 120)).toEqual({ state: 'parked', online: true });
  });

  it('raises low fuel, low battery and harsh driving alerts', () => {
    const none = { brake: 0, accel: 0, turn: 0 };
    expect(vehicleAlerts(60, 90, none)).toEqual([]);
    expect(vehicleAlerts(10, 90, none)).toEqual(['low_fuel']);
    expect(vehicleAlerts(60, 15, none)).toEqual(['low_battery']);
    expect(vehicleAlerts(null, null, { brake: 1, accel: 0, turn: 0 })).toEqual(['harsh_driving']);
  });
});

describe('API keys', () => {
  const keys = ['a'.repeat(40), 'b'.repeat(40)];

  it('accepts a listed key and refuses anything else', () => {
    expect(matchesKey('b'.repeat(40), keys)).toBe(true);
    expect(matchesKey('c'.repeat(40), keys)).toBe(false);
    expect(matchesKey('a', keys)).toBe(false);
    expect(matchesKey('', keys)).toBe(false);
  });
});
