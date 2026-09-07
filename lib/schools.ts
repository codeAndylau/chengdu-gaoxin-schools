import { haversineDistanceKm, polygonRing } from './geo';

export type Stage = '小学' | '初中';
export type Zone = '高新南区' | '高新西区';

export type SchoolRecord = {
  id: string;
  name: string;
  stages: Stage[];
  nature: '公办' | '民办';
  area: string;
  address: string;
  phone?: string;
  sourceType: string;
  note?: string;
  coordinateStatus: string;
  lat: number;
  lng: number;
};

export type SchoolFilters = {
  query?: string;
  stage?: '全部' | Stage;
  nature?: '全部' | '公办' | '民办';
  zone?: '全部' | Zone;
  subdistrict?: string;
  center?: { lat: number; lng: number };
  radiusKm?: number | null;
};

export type SchoolResult = SchoolRecord & {
  distanceKm: number;
};

export type StreetStat = {
  zone: Zone;
  subdistrict: string;
  total: number;
  primary: number;
  middle: number;
  public: number;
  private: number;
};

export const SUBDISTRICTS: Array<{ zone: Zone; subdistrict: string }> = [
  { zone: '高新南区', subdistrict: '肖家河' },
  { zone: '高新南区', subdistrict: '芳草' },
  { zone: '高新南区', subdistrict: '石羊' },
  { zone: '高新南区', subdistrict: '桂溪' },
  { zone: '高新南区', subdistrict: '中和' },
  { zone: '高新西区', subdistrict: '合作' },
  { zone: '高新西区', subdistrict: '西园' },
];

export function parseSchoolArea(area: string): { zone: Zone; subdistrict: string } {
  const [zone, subdistrict] = area.split('·');
  return {
    zone: (zone ?? '高新南区') as Zone,
    subdistrict: subdistrict ?? area,
  };
}

export function isApproximateCoordinate(status: string) {
  return status.includes('近似') || status.includes('待精确');
}

export function filterSchools(schools: SchoolRecord[], filters: SchoolFilters = {}): SchoolResult[] {
  const query = filters.query?.trim().toLowerCase() ?? '';
  const stage = filters.stage ?? '全部';
  const nature = filters.nature ?? '全部';
  const zone = filters.zone ?? '全部';
  const subdistrict = filters.subdistrict ?? '全部';

  const matched = schools.flatMap((school) => {
    const area = parseSchoolArea(school.area);
    const haystack = `${school.name}${school.address}${school.area}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesStage = stage === '全部' || school.stages.includes(stage);
    const matchesNature = nature === '全部' || school.nature === nature;
    const matchesZone = zone === '全部' || school.area.startsWith(zone);
    const matchesSubdistrict = subdistrict === '全部' || area.subdistrict === subdistrict;
    if (!matchesQuery || !matchesStage || !matchesNature || !matchesZone || !matchesSubdistrict) {
      return [];
    }

    const distanceKm = filters.center
      ? haversineDistanceKm(filters.center.lat, filters.center.lng, school.lat, school.lng)
      : 0;
    if (filters.center && filters.radiusKm != null && distanceKm > filters.radiusKm) {
      return [];
    }
    return [{ ...school, distanceKm }];
  });

  if (filters.center) {
    matched.sort((a, b) => a.distanceKm - b.distanceKm);
  }
  return matched;
}

export function streetStats(schools: SchoolRecord[]): StreetStat[] {
  return SUBDISTRICTS.map((item) => {
    const items = schools.filter((school) => parseSchoolArea(school.area).subdistrict === item.subdistrict);
    return {
      ...item,
      total: items.length,
      primary: items.filter((school) => school.stages.includes('小学')).length,
      middle: items.filter((school) => school.stages.includes('初中')).length,
      public: items.filter((school) => school.nature === '公办').length,
      private: items.filter((school) => school.nature === '民办').length,
    };
  });
}

export function referenceBoundaries(schools: SchoolRecord[]) {
  const zoneFeatures = (['高新南区', '高新西区'] as const).flatMap((zone) => {
    const points = schools.filter((school) => school.area.startsWith(zone)).map((school) => ({
      lat: school.lat,
      lng: school.lng,
    }));
    const ring = polygonRing(points);
    if (ring.length < 4) return [];
    return [{
      type: 'Feature' as const,
      properties: { kind: 'zone' as const, name: zone },
      geometry: { type: 'Polygon' as const, coordinates: [ring] },
    }];
  });

  const streetFeatures = SUBDISTRICTS.flatMap((item) => {
    const points = schools
      .filter((school) => parseSchoolArea(school.area).subdistrict === item.subdistrict)
      .map((school) => ({ lat: school.lat, lng: school.lng }));
    const ring = polygonRing(points, 0.003);
    if (ring.length < 4) return [];
    return [{
      type: 'Feature' as const,
      properties: { kind: 'street' as const, name: item.subdistrict, zone: item.zone },
      geometry: { type: 'Polygon' as const, coordinates: [ring] },
    }];
  });

  return {
    type: 'FeatureCollection' as const,
    features: [...zoneFeatures, ...streetFeatures],
  };
}
