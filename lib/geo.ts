export type LatLng = {
  lat: number;
  lng: number;
};

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function haversineDistanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} 米`;
  }
  return `${distanceKm.toFixed(1)} 公里`;
}

function cross(origin: LatLng, a: LatLng, b: LatLng) {
  return (a.lng - origin.lng) * (b.lat - origin.lat) - (a.lat - origin.lat) * (b.lng - origin.lng);
}

export function convexHull(points: LatLng[]): LatLng[] {
  const unique = [...new Map(points.map((point) => [`${point.lat},${point.lng}`, point])).values()];
  if (unique.length <= 2) return unique;

  const sorted = [...unique].sort((a, b) => a.lng - b.lng || a.lat - b.lat);
  const lower: LatLng[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: LatLng[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export function padPolygon(points: LatLng[], padDegrees: number): LatLng[] {
  if (points.length === 0) return [];
  const centroid = {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };

  return points.map((point) => {
    const dLat = point.lat - centroid.lat;
    const dLng = point.lng - centroid.lng;
    const length = Math.hypot(dLat, dLng) || 1;
    return {
      lat: point.lat + (dLat / length) * padDegrees,
      lng: point.lng + (dLng / length) * padDegrees,
    };
  });
}

export function polygonRing(points: LatLng[], padDegrees = 0.012): [number, number][] {
  if (points.length === 0) return [];

  const source = points.length < 3
    ? (() => {
      const lats = points.map((point) => point.lat);
      const lngs = points.map((point) => point.lng);
      return [
        { lat: Math.min(...lats), lng: Math.min(...lngs) },
        { lat: Math.max(...lats), lng: Math.min(...lngs) },
        { lat: Math.max(...lats), lng: Math.max(...lngs) },
        { lat: Math.min(...lats), lng: Math.max(...lngs) },
      ];
    })()
    : convexHull(points);

  const padded = padPolygon(source, padDegrees);
  const ring = padded.map((point) => [point.lng, point.lat] as [number, number]);
  ring.push(ring[0]!);
  return ring;
}

// WGS-84 → GCJ-02（火星坐标系）。
// 高德/腾讯底图使用 GCJ-02，而学校坐标来自 OpenStreetMap（WGS-84），
// 直接叠加会产生约 100–500 米偏移，因此在渲染到高德瓦片前必须转换。
const GCJ_A = 6378245.0;
const GCJ_EE = 0.006693421622965943;

function outOfChina(lat: number, lng: number) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(x: number, y: number) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0 / 3.0;
  return ret;
}

export function wgs84ToGcj02(lat: number, lng: number): LatLng {
  if (outOfChina(lat, lng)) return { lat, lng };

  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * Math.PI);
  dLng = (dLng * 180.0) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return { lat: lat + dLat, lng: lng + dLng };
}
