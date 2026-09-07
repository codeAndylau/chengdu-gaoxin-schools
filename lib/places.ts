export type Place = {
  label: string;
  lat: number;
  lng: number;
  source: 'preset' | 'nominatim' | 'coordinate';
};

export type GeocodeFn = (query: string) => Promise<Place | null>;

export type ResolvePlaceResult =
  | { ok: true; place: Place }
  | { ok: false; message: string };

// 常用预设地点（成都高新区及周边）。
// 坐标来源：高德地图公开 POI（GCJ-02），已逆转为 WGS-84 与学校 OSM 坐标统一口径，
// 渲染时再经 wgs84ToGcj02 转回 GCJ-02 与高德瓦片对齐。
export const PRESET_PLACES: Place[] = [
  { label: '桂溪街道香月湖', lat: 30.557414, lng: 104.056810, source: 'preset' },
  { label: '大源中央公园', lat: 30.551556, lng: 104.046723, source: 'preset' },
  { label: '环球中心', lat: 30.571207, lng: 104.060908, source: 'preset' },
  { label: '金融城', lat: 30.584824, lng: 104.063506, source: 'preset' },
  { label: '世纪城', lat: 30.558582, lng: 104.074137, source: 'preset' },
  { label: '中和街道', lat: 30.560969, lng: 104.090145, source: 'preset' },
  { label: '华阳街道', lat: 30.510248, lng: 104.050356, source: 'preset' },
];

export const DEFAULT_PLACE: Place = PRESET_PLACES[0]!;

export const RADIUS_OPTIONS = [1, 3, 5, 10] as const;

const CHENGDU_BBOX = {
  minLat: 30.4,
  maxLat: 30.9,
  minLng: 103.8,
  maxLng: 104.25,
};

export function normalizePlaceQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, '');
}

export function matchPresetPlace(query: string): Place | null {
  const normalized = normalizePlaceQuery(query);
  if (!normalized) return null;

  // 精确匹配预设地点名称
  const exact = PRESET_PLACES.find((place) => normalizePlaceQuery(place.label) === normalized);
  if (exact) return exact;

  // 香月湖的历史别名兼容
  const xiangyuehuAliases = ['香月湖', '桂溪街道香月湖', '桂溪香月湖', 'xiangyuehu'];
  if (xiangyuehuAliases.some((alias) => normalizePlaceQuery(alias) === normalized)) {
    return DEFAULT_PLACE;
  }

  return null;
}

// 解析经纬度输入，支持 "纬度,经度" 格式（中英文逗号均可）。
// 例如：30.5578,104.066 或 30.5578，104.066
const LAT_LNG_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)\s*$/;

export function parseLatLngInput(query: string): Place | null {
  const match = query.match(LAT_LNG_PATTERN);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    label: `坐标 ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    lat,
    lng,
    source: 'coordinate',
  };
}

export async function resolvePlace(query: string, geocode: GeocodeFn): Promise<ResolvePlaceResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, message: '请输入地点名称或经纬度（格式：纬度,经度）。' };
  }

  // 1. 预设地点匹配
  const preset = matchPresetPlace(trimmed);
  if (preset) {
    return { ok: true, place: preset };
  }

  // 2. 经纬度直接输入
  const coordinate = parseLatLngInput(trimmed);
  if (coordinate) {
    return { ok: true, place: coordinate };
  }

  // 3. 地理编码兜底（Nominatim，国内可能不可用）
  const place = await geocode(trimmed);
  if (!place) {
    return { ok: false, message: '无法解析该地点。可从下拉列表选择常用地点，或直接输入经纬度（格式：纬度,经度）。' };
  }
  return { ok: true, place };
}

export function isInsideChengduBbox(lat: number, lng: number) {
  return lat >= CHENGDU_BBOX.minLat
    && lat <= CHENGDU_BBOX.maxLat
    && lng >= CHENGDU_BBOX.minLng
    && lng <= CHENGDU_BBOX.maxLng;
}

// 从 URL 参数解析中心点：优先匹配预设地点，其次识别经纬度格式。
export function resolvePlaceFromUrlParam(param: string): Place | null {
  const preset = matchPresetPlace(param);
  if (preset) return preset;
  return parseLatLngInput(param);
}

export async function nominatimGeocode(query: string): Promise<Place | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'cn');
  url.searchParams.set('viewbox', '103.82,30.85,104.20,30.45');
  url.searchParams.set('q', `${query} 成都`);

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;

  const results = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
  const first = results[0];
  if (!first) return null;

  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInsideChengduBbox(lat, lng)) {
    return null;
  }

  return {
    label: first.display_name,
    lat,
    lng,
    source: 'nominatim',
  };
}
