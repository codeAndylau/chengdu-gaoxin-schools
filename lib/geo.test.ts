import { describe, expect, it } from 'vitest';

import { convexHull, formatDistanceKm, haversineDistanceKm, padPolygon, wgs84ToGcj02 } from './geo';

describe('haversineDistanceKm', () => {
  it('treats one degree of latitude as about 111 km', () => {
    expect(haversineDistanceKm(30, 104, 31, 104)).toBeCloseTo(111.2, 0);
  });

  it('returns zero for the same point', () => {
    expect(haversineDistanceKm(30.5578, 104.066, 30.5578, 104.066)).toBe(0);
  });
});

describe('formatDistanceKm', () => {
  it('uses meters below one kilometre', () => {
    expect(formatDistanceKm(0.35)).toBe('350 米');
  });

  it('uses kilometres with one decimal from one kilometre', () => {
    expect(formatDistanceKm(1.24)).toBe('1.2 公里');
  });
});

describe('convexHull', () => {
  it('keeps the outer corners of a square', () => {
    const hull = convexHull([
      { lat: 30.5, lng: 104.0 },
      { lat: 30.6, lng: 104.0 },
      { lat: 30.55, lng: 104.04 },
      { lat: 30.5, lng: 104.08 },
      { lat: 30.6, lng: 104.08 },
    ]);

    expect(hull).toHaveLength(4);
    expect(new Set(hull.map((point) => `${point.lat},${point.lng}`))).toEqual(
      new Set(['30.5,104', '30.6,104', '30.6,104.08', '30.5,104.08']),
    );
  });
});

describe('padPolygon', () => {
  it('expands a polygon away from its centroid', () => {
    const padded = padPolygon(
      [
        { lat: 30.5, lng: 104.0 },
        { lat: 30.6, lng: 104.0 },
        { lat: 30.6, lng: 104.1 },
        { lat: 30.5, lng: 104.1 },
      ],
      0.01,
    );

    expect(padded[0].lat).toBeLessThan(30.5);
    expect(padded[0].lng).toBeLessThan(104.0);
    expect(padded[2].lat).toBeGreaterThan(30.6);
    expect(padded[2].lng).toBeGreaterThan(104.1);
  });
});

describe('wgs84ToGcj02', () => {
  it('shifts a Chengdu point by a small offset within GCJ-02 range', () => {
    const result = wgs84ToGcj02(30.5578, 104.066);
    // 成都地区 GCJ-02 相对 WGS-84 的偏移量通常在 0.001–0.01° 之间（约 100–1000 米）
    const dLat = Math.abs(result.lat - 30.5578);
    const dLng = Math.abs(result.lng - 104.066);
    expect(dLat).toBeGreaterThan(0.0005);
    expect(dLng).toBeGreaterThan(0.0005);
    expect(dLat).toBeLessThan(0.01);
    expect(dLng).toBeLessThan(0.01);
  });

  it('is deterministic for the same input', () => {
    const a = wgs84ToGcj02(30.5578, 104.066);
    const b = wgs84ToGcj02(30.5578, 104.066);
    expect(a.lat).toBe(b.lat);
    expect(a.lng).toBe(b.lng);
  });

  it('leaves points outside China unchanged', () => {
    const result = wgs84ToGcj02(35.0, 10.0);
    expect(result.lat).toBe(35.0);
    expect(result.lng).toBe(10.0);
  });
});
