'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  ArrowUpRight,
  Building2,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Footprints,
  GraduationCap,
  Heart,
  Map,
  MapPin,
  Navigation,
  Phone,
  Scale,
  Search,
  School,
  SlidersHorizontal,
  Bike,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import schoolData from '@/data/schools.json';
import { formatDistanceKm, formatTravelTimes, wgs84ToGcj02 } from '@/lib/geo';
import { DEFAULT_PLACE, PRESET_PLACES, RADIUS_OPTIONS, nominatimGeocode, resolvePlace, resolvePlaceFromUrlParam, type Place } from '@/lib/places';
import {
  filterSchools,
  isApproximateCoordinate,
  referenceBoundaries,
  streetStats,
  type SchoolRecord,
  type Stage,
  type Zone,
} from '@/lib/schools';
import type { SchoolMapViewProps } from '@/lib/map-view';

const schools = schoolData as SchoolRecord[];

// 从 URL 参数读取中心点（支持 ?place=预设地点名 或 ?center=纬度,经度）
function readPlaceFromUrl(): Place {
  if (typeof window === 'undefined') return DEFAULT_PLACE;
  const params = new URLSearchParams(window.location.search);
  const placeParam = params.get('place') ?? params.get('center');
  if (placeParam) {
    const resolved = resolvePlaceFromUrlParam(placeParam);
    if (resolved) return resolved;
  }
  return DEFAULT_PLACE;
}

function readPlaceInputFromUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_PLACE.label;
  const params = new URLSearchParams(window.location.search);
  const placeParam = params.get('place') ?? params.get('center');
  if (placeParam) {
    const resolved = resolvePlaceFromUrlParam(placeParam);
    if (resolved) return resolved.source === 'preset' ? resolved.label : placeParam;
  }
  return DEFAULT_PLACE.label;
}

function readRadiusFromUrl(): number | null {
  if (typeof window === 'undefined') return 5;
  const params = new URLSearchParams(window.location.search);
  const radiusParam = params.get('radius');
  if (radiusParam) {
    const r = Number(radiusParam);
    if (Number.isFinite(r) && r > 0) return r;
    if (radiusParam === '不限' || radiusParam === 'all') return null;
  }
  return 5;
}

const sources = [
  {
    label: '2026 年高新区小学入学登记点',
    host: '成都高新区教育体育局信息转载',
    href: 'https://www.sohu.com/a/1014081352_121118946',
  },
  {
    label: '2026 年成都高新区小升初划片范围',
    host: '成都教育发布 / 红星新闻网',
    href: 'https://news.chengdu.cn/2026/0701/6a44dd8fd6f51f4f4c3b78cb.shtml',
  },
  {
    label: '2026 年高新区小升初对应表',
    host: '九考网资料整理',
    href: 'https://www.jiukao.com/fw/202606/11598.html',
  },
  {
    label: '2026 年成都义务教育入学政策',
    host: '成都教育发布 / 成都网',
    href: 'https://mobile.chengdu.cn/show/id/69b28243f34d440475d454d6',
  },
  {
    label: '成都美视师一学校 2026 招生简章',
    host: '学校官网',
    href: 'https://www.meishischool.com/html/Admissions/',
  },
];

const stageStyles: Record<string, string> = {
  小学: '#357e9c',
  初中: '#d56e35',
  一贯制: '#7a5aa6',
};

export default function Home({ map: injectedMap }: { map?: ComponentType<SchoolMapViewProps> } = {}) {
  const [query, setQuery] = useState('');
  const [placeInput, setPlaceInput] = useState(() => readPlaceInputFromUrl());
  const [place, setPlace] = useState<Place>(() => readPlaceFromUrl());
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const [presetShowAll, setPresetShowAll] = useState(false);
  const presetDropdownRef = useRef<HTMLDivElement>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(() => readRadiusFromUrl());
  const [stage, setStage] = useState<'全部' | Stage>('全部');
  const [nature, setNature] = useState<'全部' | '公办' | '民办'>('全部');
  const [zone, setZone] = useState<'全部' | Zone>('全部');
  const [subdistrict, setSubdistrict] = useState('全部');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [MapComponent, setMapComponent] = useState<ComponentType<SchoolMapViewProps> | null>(
    () => injectedMap ?? null,
  );
  const [mapError, setMapError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('gx-school-favorites') ?? '[]'); } catch { return []; }
  });
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  // 收藏持久化
  useEffect(() => {
    localStorage.setItem('gx-school-favorites', JSON.stringify(favorites));
  }, [favorites]);

  function toggleFavorite(id: string) {
    setFavorites((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  // 高德导航URI（无需Key）
  function openNavigation(school: { lat: number; lng: number; name: string }, mode: 'car' | 'bus' | 'walk' | 'ride') {
    const gcj = wgs84ToGcj02(school.lat, school.lng);
    const modeMap = { car: 'car', bus: 'bus', walk: 'walk', ride: 'ride' };
    const url = `https://uri.amap.com/navigation?to=${gcj.lng},${gcj.lat},${encodeURIComponent(school.name)}&mode=${modeMap[mode]}&src=webapp&coordinate=gaode&callnative=1`;
    window.open(url, '_blank', 'noopener');
  }

  useEffect(() => {
    if (injectedMap) return;
    let cancelled = false;
    void import('./leaflet-school-map')
      .then((mod) => {
        if (cancelled) return;
        if (!mod.default) throw new Error('地图组件未能加载');
        setMapComponent(() => mod.default);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : '地图加载失败');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [injectedMap]);

  // 中心点或半径变化时，把状态回写到 URL（replaceState 不刷新页面）
  useEffect(() => {
    const params = new URLSearchParams();
    if (place.source === 'preset') {
      params.set('place', place.label);
    } else {
      params.set('center', `${place.lat.toFixed(6)},${place.lng.toFixed(6)}`);
    }
    params.set('radius', radiusKm == null ? '不限' : String(radiusKm));
    const newSearch = `?${params.toString()}`;
    if (window.location.search !== newSearch) {
      window.history.replaceState(null, '', newSearch);
    }
  }, [place, radiusKm]);

  // 点击预设地点下拉框外部时关闭
  useEffect(() => {
    if (!presetDropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(event.target as Node)) {
        setPresetDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [presetDropdownOpen]);

  const boundaries = useMemo(() => referenceBoundaries(schools), []);
  const streets = useMemo(() => streetStats(schools), []);

  // 预设地点下拉列表：点击箭头展开时显示全部，输入时过滤
  const visiblePresets = useMemo(() => {
    if (presetShowAll) return PRESET_PLACES;
    const q = placeInput.trim().toLowerCase();
    if (!q) return PRESET_PLACES;
    return PRESET_PLACES.filter((p) => p.label.toLowerCase().includes(q));
  }, [placeInput, presetShowAll]);

  // 学校名搜索结果（三级搜索之一）
  const matchedSchools = useMemo(() => {
    const q = placeInput.trim().toLowerCase();
    if (!q || presetShowAll) return [];
    return schools
      .filter((s) => s.name.toLowerCase().includes(q) || (s.address ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [placeInput, presetShowAll]);

  const filtered = useMemo(() => filterSchools(schools, {
    query,
    stage,
    nature,
    zone,
    subdistrict,
    center: place,
    radiusKm,
  }), [nature, place, query, radiusKm, stage, subdistrict, zone]);

  const selected = filtered.find((school) => school.id === selectedId) ?? filtered[0];
  const exactCount = schools.filter((school) => school.coordinateStatus.startsWith('OpenStreetMap校名')).length;
  const hasApproximateDistance = filtered.some((school) => isApproximateCoordinate(school.coordinateStatus));

  async function handlePlaceSearch(event?: { preventDefault(): void }) {
    event?.preventDefault();
    setPlaceLoading(true);
    setPlaceError(null);
    try {
      const result = await resolvePlace(placeInput, nominatimGeocode);
      if (result.ok) {
        setPlace(result.place);
        setPlaceInput(result.place.label === DEFAULT_PLACE.label ? DEFAULT_PLACE.label : placeInput.trim());
      } else {
        setPlaceError(result.message);
      }
    } catch {
      setPlaceError('地点解析暂时不可用，已保留当前中心点。');
    } finally {
      setPlaceLoading(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // 剪贴板不可用时静默失败
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1560px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Map className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.16em] text-primary/70">CHENGDU · GAOXIN</p>
              <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">成都高新区教育资源地图</h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <CheckCircle2 className="size-4 text-primary" />
            数据更新至 2026-09-02
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge className="bg-[#e5f1ed] text-[#176b5a]">2026 教育资源底图</Badge>
              <span className="text-xs text-muted-foreground">按实际校区统计</span>
            </div>
            <h2 className="max-w-3xl font-heading text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              按位置找学校，按街道看分布
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              默认以桂溪街道香月湖为中心查看 5 公里范围。地图用于观察资源密度，边界和距离均为便民参考，入学资格与划片请以教育部门当年公告为准。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {[
              ['校区', schools.length],
              ['小学', schools.filter((item) => item.stages.includes('小学')).length],
              ['初中', schools.filter((item) => item.stages.includes('初中')).length],
              ['公办', schools.filter((item) => item.nature === '公办').length],
              ['民办', schools.filter((item) => item.nature === '民办').length],
            ].map(([label, value]) => (
              <div key={label} className="min-w-[76px] rounded-xl border border-border bg-card px-3 py-2.5 text-center shadow-sm">
                <strong className="block text-xl font-bold tabular-nums text-primary">{value}</strong>
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          {/* 收藏与对比入口 */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCompare(true)}
              disabled={compareIds.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Scale className="size-3.5" /> 对比 ({compareIds.length}/3)
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              <Heart className="size-3.5 fill-[#e74c3c] text-[#e74c3c]" /> 已收藏 {favorites.length} 所
            </span>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-border bg-card p-3 shadow-sm">
          <form className="mb-3 grid gap-3 lg:grid-cols-[minmax(260px,1.2fr)_auto_auto]" onSubmit={handlePlaceSearch}>
            <div className="relative block" ref={presetDropdownRef}>
              <span className="sr-only">搜索地点作为查询中心</span>
              <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="place-search"
                value={placeInput}
                onChange={(event) => {
                  setPlaceInput(event.target.value);
                  setPresetShowAll(false);
                  if (!presetDropdownOpen) setPresetDropdownOpen(true);
                }}
                onFocus={() => {
                  setPresetShowAll(false);
                  setPresetDropdownOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setPresetDropdownOpen(false);
                }}
                className="h-10 rounded-xl border-0 bg-muted pl-9 pr-10 shadow-none focus-visible:ring-primary/25"
                placeholder="输入地点或经纬度（纬度,经度），例：桂溪街道香月湖"
              />
              <button
                type="button"
                aria-label="展开常用地点"
                onClick={() => {
                  setPresetShowAll(true);
                  setPresetDropdownOpen((prev) => !prev);
                }}
                className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-background hover:text-foreground"
              >
                <ChevronDown className={`size-4 transition-transform ${presetDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {presetDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  <div className="max-h-72 overflow-y-auto p-1">
                    {matchedSchools.length === 0 && visiblePresets.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">无匹配结果，可直接输入经纬度（纬度,经度）</p>
                    ) : (
                      <>
                        {matchedSchools.length > 0 && (
                          <div className="mb-1">
                            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">学校</p>
                            {matchedSchools.map((school) => (
                              <button
                                key={`school-${school.id}`}
                                type="button"
                                onClick={() => {
                                  setSelectedId(school.id);
                                  setPlaceInput(school.name);
                                  setPresetDropdownOpen(false);
                                  setPresetShowAll(false);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted"
                              >
                                <School className="size-3.5 shrink-0 text-[#176b5a]" />
                                <span className="min-w-0 flex-1 truncate">{school.name}</span>
                                <span className="shrink-0 text-[10px] text-muted-foreground">{school.stages.join('/')}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {visiblePresets.length > 0 && (
                          <div>
                            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">地点/商圈</p>
                            {visiblePresets.map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  setPlaceInput(preset.label);
                                  setPresetDropdownOpen(false);
                                  setPresetShowAll(false);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted"
                              >
                                <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{preset.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Button type="submit" className="h-10 rounded-xl" disabled={placeLoading}>
              {placeLoading ? '解析中' : '查询周边'}
            </Button>
            <SegmentedFilter
              label="半径"
              value={radiusKm == null ? '不限' : `${radiusKm}公里`}
              values={[...RADIUS_OPTIONS.map((item) => `${item}公里`), '不限']}
              onChange={(value) => setRadiusKm(value === '不限' ? null : Number(value.replace('公里', '')))}
            />
          </form>
          {placeError ? <p className="mb-3 text-xs text-[#9a4524]">{placeError}</p> : (
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                当前中心：{place.label} · 直线距离{radiusKm == null ? '不限半径' : `${radiusKm} 公里`}
              </p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                title="复制当前位置链接，可直接粘贴到浏览器打开"
              >
                {linkCopied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
                {linkCopied ? '已复制' : '复制链接'}
              </button>
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto_auto_auto]">
            <div className="relative block">
              <span className="sr-only">搜索学校、地址或片区</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="school-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }}
                className="h-10 rounded-xl border-0 bg-muted pl-9 pr-10 shadow-none focus-visible:ring-primary/25"
                placeholder="搜索学校、地址或片区，如：益州小学"
              />
              {query && (
                <button
                  type="button"
                  aria-label="清除搜索"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  <ChevronDown className="size-3 rotate-45" />
                </button>
              )}
            </div>
            <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => { /* 搜索即时生效，按钮用于确认/聚焦 */ document.getElementById('school-search')?.focus(); }}>
              <Search className="size-4" /> 搜索
            </Button>
            <SegmentedFilter label="学段" value={stage} values={['全部', '小学', '初中']} onChange={(value) => setStage(value as typeof stage)} />
            <SegmentedFilter label="性质" value={nature} values={['全部', '公办', '民办']} onChange={(value) => setNature(value as typeof nature)} />
            <SegmentedFilter label="区域" value={zone} values={['全部', '高新南区', '高新西区']} onChange={(value) => setZone(value as typeof zone)} />
          </div>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {streets.map((item) => {
            const active = subdistrict === item.subdistrict;
            return (
              <button
                key={item.subdistrict}
                type="button"
                aria-pressed={active}
                onClick={() => setSubdistrict(active ? '全部' : item.subdistrict)}
                className={`rounded-2xl border px-3 py-3 text-left shadow-sm transition ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">{item.subdistrict}</strong>
                  <span className={`text-[11px] ${active ? 'text-white/70' : 'text-muted-foreground'}`}>{item.zone.replace('高新', '')}</span>
                </div>
                <p className={`mt-2 text-lg font-bold tabular-nums ${active ? 'text-white' : 'text-primary'}`}>{item.total}</p>
                <p className={`mt-1 text-[11px] leading-4 ${active ? 'text-white/75' : 'text-muted-foreground'}`}>
                  小学 {item.primary} · 初中 {item.middle} · 公办 {item.public} · 民办 {item.private}
                </p>
              </button>
            );
          })}
        </div>
        <p className="mb-4 text-[11px] text-muted-foreground">街道/片区统计基于当前学校数据口径，不是官方行政区划或学区统计。</p>

        <div className="grid min-h-[680px] gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(370px,.75fr)]">
          <section className="relative overflow-hidden rounded-2xl border border-border bg-[#e8eee9] shadow-sm" aria-label="学校分布地图">
            <div className="absolute left-4 top-4 z-[1000] rounded-xl border border-white/70 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="size-4 text-primary" />
                空间分布
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">当前显示 {filtered.length} 个校区</p>
            </div>

            <div className="h-[540px] w-full xl:min-h-[640px] xl:h-[min(72vh,760px)]">
              {MapComponent ? (
                <MapComponent
                  schools={filtered}
                  selectedId={selected?.id}
                  onSelect={setSelectedId}
                  center={place}
                  radiusKm={radiusKm}
                  boundaries={boundaries}
                  highlightedStreet={subdistrict}
                />
              ) : (
                <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
                  {mapError ?? '正在加载地图'}
                </div>
              )}
            </div>

            {filtered.length === 0 && (
              <div className="pointer-events-none absolute inset-0 z-[900] grid place-items-center bg-[#e8eee9]/35 p-6">
                <div className="rounded-2xl bg-white/95 px-6 py-5 text-center shadow-sm">
                  <p className="font-bold">没有匹配的学校</p>
                  <p className="mt-1 text-sm text-muted-foreground">可扩大半径、更换中心点或减少筛选条件</p>
                </div>
              </div>
            )}

            <div className="absolute bottom-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-[11px] shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <LegendDot color={stageStyles.小学} label="小学" />
                <LegendDot color={stageStyles.初中} label="初中" />
                <LegendDot color={stageStyles.一贯制} label="一贯制" />
                <LegendDot color="#ba5b31" label="民办" />
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-5 rounded-full bg-[#c23b22]" />
                  搜索半径
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-[#176b5a]" />
                  南区/西区参考范围
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-full border-2 border-[#c23b22] bg-white" />
                  查询中心
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block rounded bg-[#f59e0b] px-1 text-[9px] font-semibold text-white">商</span>
                  商圈/地标
                </span>
              </div>
              <span className="text-muted-foreground">精确校名匹配 {exactCount} / {schools.length}，其余按片区近似</span>
            </div>
          </section>

          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="学校列表与详情">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-primary" />
                  <h3 className="font-bold">周边学校</h3>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{filtered.length} 个结果</span>
              </div>
              {hasApproximateDistance && (
                <p className="mt-2 text-[11px] text-[#815325]">部分距离基于近似点位，仅供参考。</p>
              )}
            </div>

            {selected && (
              <article id={`school-${selected.id}`} className="border-b border-border bg-[#f7faf7] p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {selected.stages.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
                      <Badge className={selected.nature === '民办' ? 'bg-[#f7e7df] text-[#9a4524]' : 'bg-[#e4f0eb] text-[#176b5a]'}>{selected.nature}</Badge>
                    </div>
                    <h3 className="text-lg font-bold leading-snug">{selected.name}</h3>
                  </div>
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-primary shadow-sm">
                    {selected.stages.length === 2 ? <Building2 className="size-5" /> : selected.stages[0] === '小学' ? <School className="size-5" /> : <GraduationCap className="size-5" />}
                  </div>
                </div>
                <dl className="space-y-2 text-sm">
                  <InfoRow icon={<MapPin />} label={selected.address} />
                  <InfoRow icon={<Map />} label={selected.area} />
                  <InfoRow icon={<Phone />} label={selected.phone ?? '公开电话待核验'} />
                  <InfoRow icon={<CircleHelp />} label={selected.sourceType} />
                </dl>
                {/* 距离与出行时间 */}
                <div className="mt-3 rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-sm font-semibold text-primary">直线距离 {formatDistanceKm(selected.distanceKm)}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                      <Footprints className="mx-auto size-3.5 text-muted-foreground" />
                      <p className="mt-0.5 text-[11px] text-muted-foreground">步行</p>
                      <p className="text-xs font-semibold">{formatTravelTimes(selected.distanceKm).walk}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                      <Bike className="mx-auto size-3.5 text-muted-foreground" />
                      <p className="mt-0.5 text-[11px] text-muted-foreground">骑行</p>
                      <p className="text-xs font-semibold">{formatTravelTimes(selected.distanceKm).bike}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                      <Car className="mx-auto size-3.5 text-muted-foreground" />
                      <p className="mt-0.5 text-[11px] text-muted-foreground">驾车</p>
                      <p className="text-xs font-semibold">{formatTravelTimes(selected.distanceKm).drive}</p>
                    </div>
                  </div>
                </div>
                {/* 操作按钮 */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openNavigation(selected, 'car')}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    <Navigation className="size-3" /> 驾车导航
                  </button>
                  <button
                    type="button"
                    onClick={() => openNavigation(selected, 'bus')}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted"
                  >
                    公交
                  </button>
                  <button
                    type="button"
                    onClick={() => openNavigation(selected, 'walk')}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted"
                  >
                    <Footprints className="size-3" /> 步行
                  </button>
                  <button
                    type="button"
                    onClick={() => openNavigation(selected, 'ride')}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted"
                  >
                    <Bike className="size-3" /> 骑行
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(selected.id)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${favorites.includes(selected.id) ? 'bg-[#fde8e8] text-[#c0392b]' : 'border border-border bg-background hover:bg-muted'}`}
                  >
                    <Heart className={`size-3 ${favorites.includes(selected.id) ? 'fill-current' : ''}`} />
                    {favorites.includes(selected.id) ? '已收藏' : '收藏'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCompare(selected.id)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${compareIds.includes(selected.id) ? 'bg-[#e8f0fd] text-[#2563eb]' : 'border border-border bg-background hover:bg-muted'}`}
                  >
                    <Scale className="size-3" />
                    {compareIds.includes(selected.id) ? '已加入对比' : '对比'}
                  </button>
                </div>
                {selected.note && <p className="mt-3 rounded-lg bg-[#fff2df] px-3 py-2 text-xs leading-5 text-[#815325]">{selected.note}</p>}
                <p className="mt-3 text-[11px] text-muted-foreground">点位：{selected.coordinateStatus}</p>
              </article>
            )}

            <div className="school-list min-h-[260px] flex-1 overflow-y-auto p-2">
              {filtered.map((school) => (
                <div
                  key={school.id}
                  onClick={() => setSelectedId(school.id)}
                  className={`group mb-1 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition ${selected?.id === school.id ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted'}`}
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${selected?.id === school.id ? 'bg-white/15' : 'bg-muted text-primary'}`}>
                    {school.stages.length === 2 ? <Building2 className="size-4" /> : school.stages[0] === '小学' ? <School className="size-4" /> : <GraduationCap className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{school.name}</span>
                    <span className={`mt-0.5 block truncate text-xs ${selected?.id === school.id ? 'text-white/70' : 'text-muted-foreground'}`}>
                      {school.area} · {school.stages.join(' / ')} · {formatDistanceKm(school.distanceKm)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(school.id); }}
                    className={`shrink-0 rounded-md p-1 transition ${favorites.includes(school.id) ? 'text-[#e74c3c]' : selected?.id === school.id ? 'text-white/50 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    aria-label={favorites.includes(school.id) ? '取消收藏' : '收藏'}
                  >
                    <Heart className={`size-3.5 ${favorites.includes(school.id) ? 'fill-current' : ''}`} />
                  </button>
                  <ChevronRight className={`size-4 shrink-0 ${selected?.id === school.id ? 'text-white/70' : 'text-muted-foreground group-hover:translate-x-0.5'} transition`} />
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="grid min-h-44 place-items-center px-6 text-center text-sm text-muted-foreground">
                  暂无匹配结果。可尝试扩大半径、更换中心点或切换筛选条件。
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* 学校对比面板 */}
        {showCompare && compareIds.length > 0 && (
          <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="size-5 text-primary" />
                <h3 className="font-bold">学校对比</h3>
              </div>
              <button type="button" onClick={() => setShowCompare(false)} className="text-xs text-muted-foreground hover:text-foreground">关闭</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">对比项</th>
                    {compareIds.map((id) => {
                      const s = schools.find((x) => x.id === id);
                      if (!s) return null;
                      return (
                        <th key={id} className="py-2 px-3 text-left">
                          <span className="block truncate font-semibold">{s.name}</span>
                          <button type="button" onClick={() => toggleCompare(id)} className="mt-0.5 text-[10px] text-muted-foreground hover:text-[#c0392b]">移除</button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr><td className="py-2 pr-4 text-xs text-muted-foreground">性质</td>{compareIds.map((id) => { const s = schools.find((x) => x.id === id); return <td key={id} className="py-2 px-3">{s?.nature}</td>; })}</tr>
                  <tr><td className="py-2 pr-4 text-xs text-muted-foreground">学段</td>{compareIds.map((id) => { const s = schools.find((x) => x.id === id); return <td key={id} className="py-2 px-3">{s?.stages.join(' / ')}</td>; })}</tr>
                  <tr><td className="py-2 pr-4 text-xs text-muted-foreground">区域</td>{compareIds.map((id) => { const s = schools.find((x) => x.id === id); return <td key={id} className="py-2 px-3">{s?.area}</td>; })}</tr>
                  <tr><td className="py-2 pr-4 text-xs text-muted-foreground">地址</td>{compareIds.map((id) => { const s = schools.find((x) => x.id === id); return <td key={id} className="py-2 px-3 text-xs">{s?.address}</td>; })}</tr>
                  <tr><td className="py-2 pr-4 text-xs text-muted-foreground">距中心</td>{compareIds.map((id) => { const s = filtered.find((x) => x.id === id); return <td key={id} className="py-2 px-3">{s ? formatDistanceKm(s.distanceKm) : '-'}</td>; })}</tr>
                  <tr><td className="py-2 pr-4 text-xs text-muted-foreground">电话</td>{compareIds.map((id) => { const s = schools.find((x) => x.id === id); return <td key={id} className="py-2 px-3 text-xs">{s?.phone ?? '待核验'}</td>; })}</tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 入学政策时间线 */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" />
            <h3 className="font-bold">成都高新区入学政策时间线（参考）</h3>
          </div>
          <div className="relative pl-6">
            <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
            {[
              { month: '3月', title: '政策发布', desc: '高新区教育体育局发布当年义务教育入学工作实施细则' },
              { month: '4月', title: '信息采集', desc: '适龄儿童少年法定监护人登录"成都市义务教育招生入学服务平台"完成信息采集' },
              { month: '5月', title: '资料审核', desc: '公办学校现场资料审核；民办学校网上报名' },
              { month: '6月', title: '划片公布', desc: '公布公办学校划片范围；民办学校电脑随机录取' },
              { month: '7月', title: '录取确认', desc: '公办学校录取结果公布；家长确认学位' },
              { month: '8月', title: '报到注册', desc: '新生报到注册，准备入学' },
            ].map((item, i) => (
              <div key={i} className="relative mb-4 last:mb-0">
                <div className="absolute -left-[18px] top-1 size-3 rounded-full border-2 border-primary bg-card" />
                <p className="text-sm font-semibold">{item.month} · {item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">以上为往年常规时间节点参考，具体以当年教育部门公告为准。</p>
        </section>

        {/* 学区划片查询 */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="size-5 text-primary" />
            <h3 className="font-bold">学区划片查询（按街道）</h3>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">选择街道查看该区域内的学校。小区级精确划片数据正在建设中，建议以教育部门当年公告为准。</p>
          <div className="flex flex-wrap gap-2">
            {streets.map((street) => (
              <button
                key={street.subdistrict}
                type="button"
                onClick={() => setSubdistrict(subdistrict === street.subdistrict ? '全部' : street.subdistrict)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${subdistrict === street.subdistrict ? 'bg-primary text-primary-foreground' : 'border border-border bg-background hover:bg-muted'}`}
              >
                {street.subdistrict}（{street.count}所）
              </button>
            ))}
          </div>
          {subdistrict !== '全部' && (
            <div className="mt-4 rounded-xl bg-muted/50 p-3">
              <p className="mb-2 text-xs font-semibold">{subdistrict} 范围内学校：</p>
              <div className="flex flex-wrap gap-1.5">
                {filtered.filter((s) => s.area.includes(subdistrict)).map((s) => (
                  <span key={s.id} className="rounded-md bg-background px-2 py-1 text-xs">{s.name}</span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <CircleHelp className="size-5 text-primary" />
              <h3 className="font-bold">怎样理解这份地图</h3>
            </div>
            <div className="grid gap-3 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
              <p><strong className="text-foreground">底图来自高德地图</strong>（标准路网瓦片，无需 Key），可缩放和拖拽。高新区南区、西区轮廓由当前校区点位生成参考范围，不是官方行政或学区边界。</p>
              <p><strong className="text-foreground">距离按直线计算</strong>，默认示例为桂溪街道香月湖周边 5 公里。半径范围不是入学资格范围，也不能替代划片查询。</p>
              <p><strong className="text-foreground">点位精度分两档</strong>：校名在 OpenStreetMap 匹配到的展示实际点位；未匹配到的按所属片区近似展示，虚线点位表示待核验。</p>
              <p><strong className="text-foreground">不作学区承诺</strong>：学位安排与入学资格会受户籍、实际居住、当年招生计划和电脑随机录取政策影响。</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-bold">主要资料来源</h3>
              <Badge variant="outline">5 项</Badge>
            </div>
            <div className="space-y-2">
              {sources.map((source) => (
                <a key={source.href} href={source.href} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 hover:border-border hover:bg-muted">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-primary"><ArrowUpRight className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{source.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{source.host}</span>
                  </span>
                </a>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
              地图底图 © 高德地图（GCJ-02 坐标系，学校 WGS-84 坐标已做转换对齐）。边界为参考范围，生成自 2026-09-02 学校点位。香月湖中心按益州大道中段、环球中心南侧公开地址做参考定位。
            </p>
          </div>
        </section>

        <footer className="py-6 text-center text-xs leading-5 text-muted-foreground">
          本页面为便民资料整理，不代表教育行政部门官方查询结果。涉及报名、划片和录取时，请回到“成都高新区教育体育局”当年公告核验。
        </footer>
      </section>
    </main>
  );
}

function SegmentedFilter({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <fieldset className="flex min-w-0 items-center gap-1 rounded-xl bg-muted p-1">
      <legend className="sr-only">{label}</legend>
      {values.map((item) => (
        <Button
          key={item}
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={value === item}
          onClick={() => onChange(item)}
          className={`rounded-lg px-2.5 text-xs ${value === item ? 'bg-white text-foreground shadow-sm hover:bg-white' : 'text-muted-foreground hover:bg-white/60'}`}
        >
          {item}
        </Button>
      ))}
    </fieldset>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>;
}

function InfoRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-start gap-2 text-muted-foreground">
      <span className="mt-0.5 text-primary [&>svg]:size-4">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
