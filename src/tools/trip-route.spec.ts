import { distanceMeters } from './route-math';
import { DROP_TAIL_M, LEAD_IN_M, SimTrip, tripRoute } from './trip-route';

const trip = (kind: SimTrip['kind']): SimTrip => ({
  id: 7,
  ref: 'TZMS-41',
  kind,
  stops: [
    { ref: '13', name: 'Second', sequence: 2, lat: 13.08, lng: 80.2 },
    { ref: '12', name: 'First', sequence: 1, lat: 13.08, lng: 80.19 },
  ],
  destination: { name: 'School', lat: 13.08, lng: 80.21 },
});

describe('trip simulator route', () => {
  it('starts a pickup about 1.5 km before the first stop and ends at the destination', () => {
    const route = tripRoute(trip('pickup'));
    expect(route.points.slice(1)).toEqual([
      [13.08, 80.19],
      [13.08, 80.2],
      [13.08, 80.21],
    ]);
    expect(distanceMeters(route.points[0], route.points[1])).toBeCloseTo(LEAD_IN_M, -1);
    expect(route.points[0][1]).toBeLessThan(80.19);
    expect(route.stops).toEqual([
      { index: 1, name: 'First' },
      { index: 2, name: 'Second' },
    ]);
  });

  it('starts a drop at the destination and drives on past the last stop', () => {
    const route = tripRoute(trip('drop'));
    expect(route.points[0]).toEqual([13.08, 80.21]);
    const [last, tail] = route.points.slice(-2);
    expect(last).toEqual([13.08, 80.2]);
    expect(distanceMeters(last, tail)).toBeCloseTo(DROP_TAIL_M, -1);
    expect(tail[1]).toBeGreaterThan(80.2);
  });
});
