import { describe, expect, it } from 'vitest';

import schoolData from '../data/schools.json';
import { DEFAULT_PLACE } from './places';
import { filterSchools, parseSchoolArea, streetStats } from './schools';
import type { SchoolRecord } from './schools';

const fixture: SchoolRecord[] = [
  {
    id: 'near-primary',
    name: '桂溪小学',
    stages: ['小学'],
    nature: '公办',
    area: '高新南区·桂溪',
    address: '益州大道',
    sourceType: '2026小学登记点',
    coordinateStatus: 'OpenStreetMap校名匹配',
    lat: 30.56,
    lng: 104.066,
  },
  {
    id: 'near-combined',
    name: '桂溪一贯制',
    stages: ['小学', '初中'],
    nature: '公办',
    area: '高新南区·石羊',
    address: '石羊场',
    sourceType: '2026小学登记点 / 九年一贯制',
    coordinateStatus: '片区近似定位（待精确坐标核验）',
    lat: 30.558,
    lng: 104.07,
    note: '一贯制',
  },
  {
    id: 'west-middle',
    name: '合作中学',
    stages: ['初中'],
    nature: '民办',
    area: '高新西区·合作',
    address: '西区大道',
    phone: '028-00000000',
    sourceType: '2026民办招生简章',
    coordinateStatus: 'OpenStreetMap校名匹配',
    lat: 30.78,
    lng: 103.91,
  },
];

const xiangyuehu = { lat: 30.5578, lng: 104.066 };

describe('parseSchoolArea', () => {
  it('splits zone and subdistrict from the area field', () => {
    expect(parseSchoolArea('高新南区·桂溪')).toEqual({
      zone: '高新南区',
      subdistrict: '桂溪',
    });
  });
});

describe('filterSchools', () => {
  it('keeps nine-year schools in both primary and middle filters', () => {
    const primary = filterSchools(fixture, { stage: '小学' });
    const middle = filterSchools(fixture, { stage: '初中' });

    expect(primary.map((school) => school.id)).toEqual(['near-primary', 'near-combined']);
    expect(middle.map((school) => school.id)).toEqual(['near-combined', 'west-middle']);
  });

  it('filters by subdistrict', () => {
    const result = filterSchools(fixture, { subdistrict: '合作' });
    expect(result.map((school) => school.id)).toEqual(['west-middle']);
  });

  it('keeps schools inside a radius and sorts by distance', () => {
    const result = filterSchools(fixture, {
      center: xiangyuehu,
      radiusKm: 5,
    });

    expect(result.map((school) => school.id)).toEqual(['near-primary', 'near-combined']);
    expect(result[0]?.distanceKm).toBeLessThan(result[1]?.distanceKm ?? 1);
    expect(result.every((school) => school.distanceKm <= 5)).toBe(true);
  });

  it('keeps west-area schools out of a 5 km Xiangyuehu search', () => {
    const west = filterSchools(fixture, {
      center: xiangyuehu,
      radiusKm: 5,
      subdistrict: '合作',
    });
    expect(west).toHaveLength(0);
  });

  it('searches name, address and area', () => {
    const result = filterSchools(fixture, { query: ' 西区大道 ' });
    expect(result.map((school) => school.id)).toEqual(['west-middle']);
  });
});

describe('streetStats', () => {
  it('counts schools by subdistrict and stage', () => {
    const stats = streetStats(fixture);
    const guixi = stats.find((item) => item.subdistrict === '桂溪');
    const hezuo = stats.find((item) => item.subdistrict === '合作');

    expect(guixi).toMatchObject({
      zone: '高新南区',
      total: 1,
      primary: 1,
      middle: 0,
      public: 1,
      private: 0,
    });
    expect(hezuo).toMatchObject({
      zone: '高新西区',
      total: 1,
      primary: 0,
      middle: 1,
      public: 0,
      private: 1,
    });
  });
});

describe('current school dataset', () => {
  const allSchools = schoolData as SchoolRecord[];

  it('has 40 campuses within 5 km of Xiangyuehu', () => {
    const nearby = filterSchools(allSchools, { center: DEFAULT_PLACE, radiusKm: 5 });
    expect(nearby).toHaveLength(40);
    expect(nearby.every((school) => school.distanceKm <= 5)).toBe(true);
  });

  it('counts all current streets from the dataset', () => {
    const stats = streetStats(allSchools);
    expect(stats.map((item) => item.subdistrict)).toEqual([
      '肖家河', '芳草', '石羊', '桂溪', '中和', '合作', '西园',
    ]);
    expect(stats.reduce((sum, item) => sum + item.total, 0)).toBe(71);
  });
});
