'use client';

import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Circle, CircleMarker, GeoJSON, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';

import type { SchoolMapViewProps } from '@/lib/map-view';
import type { Place } from '@/lib/places';
import type { SchoolResult } from '@/lib/schools';
import { isApproximateCoordinate } from '@/lib/schools';
import { wgs84ToGcj02 } from '@/lib/geo';

import 'leaflet/dist/leaflet.css';

// 高德标准地图瓦片（GCJ-02 坐标系），无需 Key，国内加载快。
// style=7 为标准路网+中文注记；子域 1–4 轮询减轻单节点压力。
const AMAP_TILE_URL = 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}';

function toGcj(place: { lat: number; lng: number }) {
  return wgs84ToGcj02(place.lat, place.lng);
}

// 将 WGS-84 GeoJSON 边界整体转换为 GCJ-02，使参考边界与高德瓦片对齐。
function convertBoundariesToGcj(boundaries: SchoolMapViewProps['boundaries']) {
  return {
    ...boundaries,
    features: boundaries.features.map((feature) => ({
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: feature.geometry.coordinates.map((ring) =>
          ring.map(([lng, lat]) => {
            const gcj = wgs84ToGcj02(lat, lng);
            return [gcj.lng, gcj.lat] as [number, number];
          }),
        ),
      },
    })),
  };
}

const stageStyles: Record<string, string> = {
  小学: '#357e9c',
  初中: '#d56e35',
  一贯制: '#7a5aa6',
};

export function getMarkerColor(school: SchoolResult) {
  if (school.nature === '民办') return '#ba5b31';
  if (school.stages.length === 2) return stageStyles.一贯制;
  return stageStyles[school.stages[0]] ?? stageStyles.小学;
}

type LeafletSchoolMapProps = SchoolMapViewProps;

function MapViewport({
  schools,
  center,
  radiusKm,
}: {
  schools: SchoolResult[];
  center: Place | null;
  radiusKm: number | null;
}) {
  const map = useMap();
  const signature = `${center?.lat},${center?.lng},${radiusKm},${schools.map((school) => school.id).join(',')}`;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      map.invalidateSize();
      if (center && radiusKm) {
        const gcj = toGcj(center);
        map.fitBounds(L.latLng(gcj.lat, gcj.lng).toBounds(radiusKm * 2000), {
          padding: [36, 36],
          maxZoom: 14,
        });
        return;
      }

      if (schools.length > 0) {
        const bounds = L.latLngBounds(schools.map((school) => {
          const gcj = toGcj(school);
          return [gcj.lat, gcj.lng] as [number, number];
        }));
        if (center) {
          const gcj = toGcj(center);
          bounds.extend([gcj.lat, gcj.lng]);
        }
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [map, signature, center, radiusKm, schools]);

  return null;
}

export default function LeafletSchoolMap({
  schools,
  selectedId,
  onSelect,
  center,
  radiusKm,
  boundaries,
  highlightedStreet,
}: LeafletSchoolMapProps) {
  const gcjBoundaries = useMemo(() => convertBoundariesToGcj(boundaries), [boundaries]);
  const geojson = useMemo(() => ({
    ...gcjBoundaries,
    features: gcjBoundaries.features.filter((feature) => (
      feature.properties.kind === 'zone'
      || feature.properties.name === highlightedStreet
    )),
  }), [gcjBoundaries, highlightedStreet]);

  const mapCenter = useMemo(() => {
    if (center) {
      const gcj = toGcj(center);
      return [gcj.lat, gcj.lng] as [number, number];
    }
    const fallback = toGcj({ lat: 30.58, lng: 104.05 });
    return [fallback.lat, fallback.lng] as [number, number];
  }, [center]);

  const centerGcj = center ? toGcj(center) : null;

  return (
    <MapContainer
      center={mapCenter}
      zoom={12}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
      className="h-full w-full bg-[#e8eee9] [&_.leaflet-attribution-flag]:hidden"
      aria-label="成都高新区学校分布地图"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.amap.com/" rel="noreferrer" target="_blank">高德地图</a>'
        url={AMAP_TILE_URL}
        subdomains={['1', '2', '3', '4']}
        maxZoom={18}
      />
      <GeoJSON
        key={`${highlightedStreet}-${geojson.features.length}`}
        data={geojson}
        style={(feature) => {
          const kind = feature?.properties?.kind;
          const name = feature?.properties?.name as string | undefined;
          if (kind === 'street') {
            return {
              color: '#176b5a',
              weight: 2,
              fillColor: '#176b5a',
              fillOpacity: 0.16,
            };
          }
          return {
            color: name === '高新西区' ? '#3f6f8f' : '#176b5a',
            weight: 2,
            dashArray: '6 6',
            fillColor: name === '高新西区' ? '#3f6f8f' : '#176b5a',
            fillOpacity: 0.07,
          };
        }}
      />
      {centerGcj && radiusKm ? (
        <Circle
          center={[centerGcj.lat, centerGcj.lng]}
          radius={radiusKm * 1000}
          pathOptions={{ color: '#c23b22', weight: 2, fillColor: '#c23b22', fillOpacity: 0.06 }}
        >
          <Tooltip permanent direction="top" offset={[0, -6]} className="radius-tooltip">
            {`${radiusKm} 公里半径`}
          </Tooltip>
        </Circle>
      ) : null}
      {centerGcj ? (
        <Marker
          position={[centerGcj.lat, centerGcj.lng]}
          icon={L.divIcon({
            className: 'center-marker-wrapper',
            html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-8px);">
              <div style="background:#c23b22;color:#fff;font-size:12px;font-weight:600;padding:3px 10px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);margin-bottom:2px;">${center?.label ?? ''}</div>
              <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:7px solid #c23b22;"></div>
              <div style="width:14px;height:14px;background:#fff;border:3px solid #c23b22;border-radius:50%;margin-top:-1px;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
            </div>`,
            iconSize: [140, 44],
            iconAnchor: [70, 44],
          })}
        />
      ) : null}
      {schools.map((school) => {
        const active = selectedId === school.id;
        const approximate = isApproximateCoordinate(school.coordinateStatus);
        const gcj = toGcj(school);
        return (
          <CircleMarker
            key={school.id}
            center={[gcj.lat, gcj.lng]}
            radius={active ? 11 : 8}
            pathOptions={{
              color: getMarkerColor(school),
              weight: active ? 4 : 2.5,
              fillColor: '#fff',
              fillOpacity: approximate ? 0.55 : 0.95,
              dashArray: approximate ? '4 3' : undefined,
            }}
            eventHandlers={{
              click: () => onSelect(school.id),
            }}
          >
            <Tooltip>
              {school.name} · {school.stages.join('、')}
              {approximate ? ' · 近似点位' : ''}
            </Tooltip>
          </CircleMarker>
        );
      })}
      <MapViewport schools={schools} center={center} radiusKm={radiusKm} />
    </MapContainer>
  );
}
