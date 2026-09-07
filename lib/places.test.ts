import { describe, expect, it, vi } from 'vitest';

import { matchPresetPlace, parseLatLngInput, resolvePlace } from './places';

describe('matchPresetPlace', () => {
  it('matches the Xiangyuehu aliases', () => {
    expect(matchPresetPlace('香月湖')?.label).toBe('桂溪街道香月湖');
    expect(matchPresetPlace('桂溪街道香月湖')?.lat).toBeCloseTo(30.5578, 3);
  });

  it('matches other preset places by exact label', () => {
    expect(matchPresetPlace('环球中心')?.label).toBe('环球中心');
    expect(matchPresetPlace('大源中央公园')?.lat).toBeCloseTo(30.5491, 3);
    expect(matchPresetPlace('华阳街道')?.lng).toBeCloseTo(104.0529, 3);
  });

  it('ignores surrounding spaces and latin case', () => {
    expect(matchPresetPlace('  XiangYueHu  ')?.label).toBe('桂溪街道香月湖');
    expect(matchPresetPlace('  环球中心  ')?.label).toBe('环球中心');
  });

  it('returns null for unknown queries', () => {
    expect(matchPresetPlace('不存在的地方')).toBeNull();
  });
});

describe('parseLatLngInput', () => {
  it('parses comma-separated latitude and longitude', () => {
    const result = parseLatLngInput('30.5578,104.066');
    expect(result).not.toBeNull();
    expect(result?.lat).toBeCloseTo(30.5578, 4);
    expect(result?.lng).toBeCloseTo(104.066, 4);
    expect(result?.source).toBe('coordinate');
  });

  it('accepts Chinese comma and spaces', () => {
    const result = parseLatLngInput(' 30.5578 ， 104.066 ');
    expect(result?.lat).toBeCloseTo(30.5578, 4);
    expect(result?.lng).toBeCloseTo(104.066, 4);
  });

  it('rejects out-of-range coordinates', () => {
    expect(parseLatLngInput('91,104')).toBeNull();
    expect(parseLatLngInput('30,181')).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(parseLatLngInput('香月湖')).toBeNull();
    expect(parseLatLngInput('abc,def')).toBeNull();
  });
});

describe('resolvePlace', () => {
  it('returns a preset without calling the geocoder', async () => {
    const geocode = vi.fn();
    const result = await resolvePlace('香月湖', geocode);

    expect(geocode).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      place: { label: '桂溪街道香月湖' },
    });
  });

  it('resolves coordinate input without calling the geocoder', async () => {
    const geocode = vi.fn();
    const result = await resolvePlace('30.5578,104.066', geocode);

    expect(geocode).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.place.source).toBe('coordinate');
      expect(result.place.lat).toBeCloseTo(30.5578, 4);
    }
  });

  it('uses the geocoder for unknown places', async () => {
    const geocode = vi.fn().mockResolvedValue({
      label: '天府软件园',
      lat: 30.54,
      lng: 104.065,
      source: 'nominatim' as const,
    });

    const result = await resolvePlace('天府软件园', geocode);
    expect(result).toEqual({
      ok: true,
      place: {
        label: '天府软件园',
        lat: 30.54,
        lng: 104.065,
        source: 'nominatim',
      },
    });
  });

  it('returns a helpful miss when the geocoder cannot resolve the query', async () => {
    const geocode = vi.fn().mockResolvedValue(null);
    const result = await resolvePlace('不存在的地方xyz', geocode);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('经纬度');
    }
  });

  it('rejects empty input', async () => {
    const geocode = vi.fn();
    const result = await resolvePlace('   ', geocode);
    expect(result.ok).toBe(false);
  });
});
