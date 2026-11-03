import { GPS_TOPIC, OBD_TOPIC, TELEMETRY_TOPIC, vehicleIdFromTopic } from '../mqtt/mqtt.constants';
import { parsePayload } from '../mqtt/payload-parser';
import { TelemetryPayloadDto } from '../telemetry/dto/telemetry-payload.dto';
import { ObdPayloadDto } from './dto/obd-payload.dto';
import { obdAlerts } from './obd-faults';
import { obdRow } from './obd.service';

const now = () => Math.floor(Date.now() / 1000);
const reading = (extra: Record<string, unknown> = {}) => ({
  ts: now(),
  rpm: 1450,
  spd: 34,
  coolant: 89.5,
  load: 42,
  throttle: 18,
  fuel: 63.4,
  volt: 13.9,
  odo: 48213.7,
  dtc: [],
  ...extra,
});

describe('MQTT topics', () => {
  it('takes the IMEI from the + segment of each topic', () => {
    expect(vehicleIdFromTopic(GPS_TOPIC, 'fleet/860000000000001/gps')).toBe('860000000000001');
    expect(vehicleIdFromTopic(OBD_TOPIC, 'fleet/860000000000001/obd')).toBe('860000000000001');
    expect(vehicleIdFromTopic(TELEMETRY_TOPIC, 'telematics/860000000000001/telemetry')).toBe('860000000000001');
  });

  it('refuses topics that do not match the filter', () => {
    expect(vehicleIdFromTopic(GPS_TOPIC, 'fleet/860000000000001/obd')).toBeNull();
    expect(vehicleIdFromTopic(GPS_TOPIC, 'fleet/a/b/gps')).toBeNull();
    expect(vehicleIdFromTopic(GPS_TOPIC, 'fleet//gps')).toBeNull();
  });
});

describe('GPS payload', () => {
  it('accepts the same payload on fleet/{imei}/gps as on the telemetry topic', () => {
    const result = parsePayload(TelemetryPayloadDto, {
      ts: now(),
      lat: 13.0849,
      lng: 80.2081,
      spd: 32,
      hdg: 90,
      ign: 1,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a position outside the world with a reason', () => {
    const result = parsePayload(TelemetryPayloadDto, { ts: now(), lat: 130.8, lng: 80.2 });
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('lat') });
  });
});

describe('OBD payload', () => {
  it('accepts a full reading', () => {
    const result = parsePayload(ObdPayloadDto, reading({ dtc: ['P0301', 'U0100'] }));
    expect(result.ok).toBe(true);
  });

  it('accepts a partial reading with only some PIDs', () => {
    expect(parsePayload(ObdPayloadDto, { ts: now(), coolant: 92 }).ok).toBe(true);
  });

  it.each([
    ['not an object', 'rpm=1450', 'not a JSON object'],
    ['an array', [1, 2], 'not a JSON object'],
    ['no readings', { ts: now() }, 'no OBD reading'],
    ['a date string ts', reading({ ts: '2026-11-03T08:00:00Z' }), 'ts must be Unix time'],
    ['milliseconds ts', reading({ ts: Date.now() }), 'ts must be current Unix time'],
    ['coolant above 215', reading({ coolant: 400 }), 'coolant must be between -40 and 215'],
    ['negative rpm', reading({ rpm: -5 }), 'rpm'],
    ['rpm too high', reading({ rpm: 25000 }), 'rpm must be between 0 and 10000'],
    ['load above 100', reading({ load: 140 }), 'load must be a percentage'],
    ['fuel as text', reading({ fuel: 'full' }), 'fuel'],
    ['dtc not a list', reading({ dtc: 'P0301' }), 'dtc must be an array'],
    ['malformed dtc', reading({ dtc: ['P0301', 'X9999'] }), 'dtc codes must look like P0301'],
  ])('rejects %s', (_, payload, reason) => {
    const result = parsePayload(ObdPayloadDto, payload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain(reason);
  });

  it('maps the payload to columns, rounding rpm and removing repeated codes', () => {
    const result = parsePayload(ObdPayloadDto, reading({ rpm: 1450.6, dtc: ['P0301', 'P0301'] }));
    if (!result.ok) throw new Error(result.reason);
    expect(obdRow(7, result.payload)).toEqual(
      expect.objectContaining({
        device_id: 7,
        rpm: 1451,
        speed: 34,
        coolant_c: 89.5,
        engine_load_pct: 42,
        throttle_pct: 18,
        fuel_pct: 63.4,
        battery_v: 13.9,
        odometer_km: 48213.7,
        dtc: ['P0301'],
      }),
    );
  });

  it('stores missing PIDs as null', () => {
    const result = parsePayload(ObdPayloadDto, { ts: now(), rpm: 800 });
    if (!result.ok) throw new Error(result.reason);
    expect(obdRow(1, result.payload)).toEqual(
      expect.objectContaining({ rpm: 800, coolant_c: null, odometer_km: null, dtc: [] }),
    );
  });
});

describe('OBD faults', () => {
  const at = new Date('2026-11-03T08:00:00Z');
  const fresh = new Date('2026-11-03T08:01:00Z');

  it('raises nothing for a healthy engine or no OBD data', () => {
    expect(obdAlerts({ coolant_c: 90, dtc: [], at }, fresh, 120)).toEqual([]);
    expect(obdAlerts(null, fresh, 120)).toEqual([]);
  });

  it('raises engine_fault for active DTC codes', () => {
    expect(obdAlerts({ coolant_c: 90, dtc: ['P0301'], at }, fresh, 120)).toEqual(['engine_fault']);
  });

  it('raises engine_overheat above 105 °C only', () => {
    expect(obdAlerts({ coolant_c: 105, dtc: [], at }, fresh, 120)).toEqual([]);
    expect(obdAlerts({ coolant_c: 108, dtc: ['P0217'], at }, fresh, 120)).toEqual(['engine_fault', 'engine_overheat']);
  });

  it('ignores an old coolant reading and DTCs older than a day', () => {
    const later = new Date('2026-11-03T09:00:00Z');
    expect(obdAlerts({ coolant_c: 110, dtc: ['P0301'], at }, later, 120)).toEqual(['engine_fault']);
    const nextDay = new Date('2026-11-04T09:00:00Z');
    expect(obdAlerts({ coolant_c: 110, dtc: ['P0301'], at }, nextDay, 120)).toEqual([]);
  });
});
