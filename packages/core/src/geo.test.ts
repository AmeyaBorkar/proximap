import { describe, expect, it } from 'vitest';
import { formatDistance, haversineMeters, parseCoordinates } from './geo';

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    expect(haversineMeters({ lat: 48.8584, lng: 2.2945 }, { lat: 48.8584, lng: 2.2945 })).toBe(0);
  });

  it('approximates one degree of longitude at the equator (~111.19 km)', () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it('matches a known city distance (Paris to London, ~340 km)', () => {
    const paris = { lat: 48.8566, lng: 2.3522 };
    const london = { lat: 51.5074, lng: -0.1278 };
    const km = haversineMeters(paris, london) / 1000;
    expect(km).toBeGreaterThan(330);
    expect(km).toBeLessThan(350);
  });
});

describe('formatDistance', () => {
  it('formats metres below 1 km', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(124.6)).toBe('125 m');
  });

  it('formats kilometres', () => {
    expect(formatDistance(1400)).toBe('1.4 km');
    expect(formatDistance(15_000)).toBe('15 km');
  });

  it('renders invalid input as an em dash', () => {
    expect(formatDistance(-1)).toBe('—');
    expect(formatDistance(Number.NaN)).toBe('—');
  });
});

describe('parseCoordinates', () => {
  it('parses a lat,lng pair', () => {
    expect(parseCoordinates('48.8584, 2.2945')).toEqual({ lat: 48.8584, lng: 2.2945 });
    expect(parseCoordinates('-33.86,151.20')).toEqual({ lat: -33.86, lng: 151.2 });
  });

  it('rejects non-coordinates and out-of-range values', () => {
    expect(parseCoordinates('Eiffel Tower')).toBeNull();
    expect(parseCoordinates('200,0')).toBeNull();
    expect(parseCoordinates('0,999')).toBeNull();
  });
});
