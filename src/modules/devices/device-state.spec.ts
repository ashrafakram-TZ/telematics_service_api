import { matchesKey } from '../../common/auth/api-key.guard';
import { deviceState } from './device-state';

describe('vehicle state', () => {
  const now = new Date('2026-11-02T08:00:00Z');

  it('has no data before the first position', () => {
    expect(deviceState(null, null, now, 120)).toEqual({ state: 'no_data', online: false });
  });

  it('is offline when the last report is older than the window', () => {
    expect(deviceState(new Date('2026-11-02T07:57:00Z'), 30, now, 120)).toEqual({ state: 'offline', online: false });
  });

  it('is moving above 2 km/h and idle otherwise', () => {
    const recent = new Date('2026-11-02T07:59:30Z');
    expect(deviceState(recent, 30, now, 120)).toEqual({ state: 'moving', online: true });
    expect(deviceState(recent, 0, now, 120)).toEqual({ state: 'idle', online: true });
    expect(deviceState(recent, null, now, 120)).toEqual({ state: 'idle', online: true });
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
