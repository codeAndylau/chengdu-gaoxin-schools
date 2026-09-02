'use client';

import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  GraduationCap,
  Map,
  MapPin,
  Phone,
  Search,
  School,
  SlidersHorizontal,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import schoolData from '@/data/schools.json';

type Stage = '小学' | '初中';
type SchoolRecord = {
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

const schools = schoolData as SchoolRecord[];

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

const projectPoint = (school: SchoolRecord, index: number) => {
  const x = 42 + ((school.lng - 103.84) / 0.34) * 816;
  const y = 36 + ((30.84 - school.lat) / 0.38) * 476;
  const jitter = ((index * 17) % 7) - 3;
  return { x: x + jitter, y: y + (((index * 11) % 7) - 3) };
};

const getMarkerColor = (school: SchoolRecord) => {
  if (school.nature === '民办') return '#ba5b31';
  if (school.stages.length === 2) return stageStyles.一贯制;
  return stageStyles[school.stages[0]];
};

export default function Home() {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<'全部' | Stage>('全部');
  const [nature, setNature] = useState<'全部' | '公办' | '民办'>('全部');
  const [zone, setZone] = useState<'全部' | '高新南区' | '高新西区'>('全部');
  const [selectedId, setSelectedId] = useState('p17');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return schools.filter((school) => {
      const haystack = `${school.name}${school.address}${school.area}`.toLowerCase();
      return (!normalized || haystack.includes(normalized))
        && (stage === '全部' || school.stages.includes(stage))
        && (nature === '全部' || school.nature === nature)
        && (zone === '全部' || school.area.startsWith(zone));
    });
  }, [nature, query, stage, zone]);

  const selected = filtered.find((school) => school.id === selectedId) ?? filtered[0];
  const exactCount = schools.filter((school) => school.coordinateStatus.startsWith('OpenStreetMap校名')).length;

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
              找学校，看分布，核对招生口径
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              汇总高新区小学、初中和一贯制学校。地图点位用于快速判断资源密度，具体入学资格与划片结果请以教育部门当年公告为准。
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
        </div>

        <div className="mb-4 rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto_auto]">
            <label htmlFor="school-search" className="relative block">
              <span className="sr-only">搜索学校、地址或片区</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="school-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 rounded-xl border-0 bg-muted pl-9 shadow-none focus-visible:ring-primary/25"
                placeholder="搜索学校、地址或片区"
              />
            </label>
            <SegmentedFilter label="学段" value={stage} values={['全部', '小学', '初中']} onChange={(value) => setStage(value as typeof stage)} />
            <SegmentedFilter label="性质" value={nature} values={['全部', '公办', '民办']} onChange={(value) => setNature(value as typeof nature)} />
            <SegmentedFilter label="区域" value={zone} values={['全部', '高新南区', '高新西区']} onChange={(value) => setZone(value as typeof zone)} />
          </div>
        </div>

        <div className="grid min-h-[680px] gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(370px,.75fr)]">
          <section className="relative overflow-hidden rounded-2xl border border-border bg-[#e8eee9] shadow-sm" aria-label="学校分布地图">
            <div className="absolute left-4 top-4 z-10 rounded-xl border border-white/70 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="size-4 text-primary" />
                空间分布
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">当前显示 {filtered.length} 个校区</p>
            </div>

            <svg className="h-[540px] w-full xl:h-full" viewBox="0 0 900 560" aria-labelledby="school-map-title">
              <title id="school-map-title">成都高新区学校点位分布图</title>
              <defs>
                <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
                  <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#91a49a" strokeOpacity=".12" strokeWidth="1" />
                </pattern>
                <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#15372e" floodOpacity=".18" />
                </filter>
              </defs>
              <rect width="900" height="560" fill="url(#grid)" />
              <path d="M66 57 C121 30 251 36 319 84 C346 119 335 187 295 219 C215 250 104 222 66 175 C43 139 43 87 66 57Z" fill="#d9e7dd" stroke="#8eb09f" strokeDasharray="5 6" />
              <path d="M408 252 C480 211 667 206 794 250 C862 285 870 402 812 483 C716 530 511 529 429 469 C381 416 366 313 408 252Z" fill="#dfe9e2" stroke="#8eb09f" strokeDasharray="5 6" />
              <path d="M455 318 C534 275 691 276 795 320" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="7" />
              <path d="M517 242 C498 310 499 401 542 505" fill="none" stroke="#fff" strokeOpacity=".65" strokeWidth="5" />
              <path d="M83 133 C151 105 240 103 313 130" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="5" />
              <text x="76" y="78" fill="#48665a" fontSize="14" fontWeight="700">高新西区</text>
              <text x="424" y="276" fill="#48665a" fontSize="14" fontWeight="700">高新南区</text>
              <text x="448" y="460" fill="#688077" fontSize="11">中和片区</text>
              <text x="702" y="428" fill="#688077" fontSize="11">桂溪 / 石羊片区</text>
              {filtered.map((school, index) => {
                const point = projectPoint(school, index);
                const active = selected?.id === school.id;
                return (
                  <a
                    key={school.id}
                    href={`#school-${school.id}`}
                    aria-label={`${school.name}，${school.stages.join('、')}`}
                    onClick={(event) => {
                      event.preventDefault();
                      setSelectedId(school.id);
                    }}
                    className="cursor-pointer outline-none"
                  >
                    <circle cx={point.x} cy={point.y} r={active ? 13 : 10} fill="white" fillOpacity={active ? 1 : .88} stroke={getMarkerColor(school)} strokeWidth={active ? 4 : 2.5} filter="url(#shadow)" />
                    {school.stages.length === 2 ? (
                      <circle cx={point.x} cy={point.y} r="3.2" fill={getMarkerColor(school)} />
                    ) : (
                      <text x={point.x} y={point.y + 3.5} textAnchor="middle" fill={getMarkerColor(school)} fontSize="9" fontWeight="800">
                        {school.stages[0] === '小学' ? '小' : '初'}
                      </text>
                    )}
                  </a>
                );
              })}
              {filtered.length === 0 && (
                <g>
                  <rect x="300" y="240" width="300" height="88" rx="18" fill="white" fillOpacity=".92" />
                  <text x="450" y="275" textAnchor="middle" fill="#18342e" fontSize="16" fontWeight="700">没有匹配的学校</text>
                  <text x="450" y="300" textAnchor="middle" fill="#6a7d75" fontSize="12">请减少筛选条件或更换关键词</text>
                </g>
              )}
            </svg>

            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-[11px] shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center gap-3">
                <LegendDot color={stageStyles.小学} label="小学" />
                <LegendDot color={stageStyles.初中} label="初中" />
                <LegendDot color={stageStyles.一贯制} label="一贯制" />
                <LegendDot color="#ba5b31" label="民办" />
              </div>
              <span className="text-muted-foreground">精确校名匹配 {exactCount} / {schools.length}，其余按片区近似</span>
            </div>
          </section>

          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="学校列表与详情">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-primary" />
                  <h3 className="font-bold">学校列表</h3>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{filtered.length} 个结果</span>
              </div>
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
                {selected.note && <p className="mt-3 rounded-lg bg-[#fff2df] px-3 py-2 text-xs leading-5 text-[#815325]">{selected.note}</p>}
                <p className="mt-3 text-[11px] text-muted-foreground">点位：{selected.coordinateStatus}</p>
              </article>
            )}

            <div className="school-list min-h-[260px] flex-1 overflow-y-auto p-2">
              {filtered.map((school) => (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => setSelectedId(school.id)}
                  className={`group mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${selected?.id === school.id ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted'}`}
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${selected?.id === school.id ? 'bg-white/15' : 'bg-muted text-primary'}`}>
                    {school.stages.length === 2 ? <Building2 className="size-4" /> : school.stages[0] === '小学' ? <School className="size-4" /> : <GraduationCap className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{school.name}</span>
                    <span className={`mt-0.5 block truncate text-xs ${selected?.id === school.id ? 'text-white/70' : 'text-muted-foreground'}`}>{school.area} · {school.stages.join(' / ')}</span>
                  </span>
                  <ChevronRight className={`size-4 shrink-0 ${selected?.id === school.id ? 'text-white/70' : 'text-muted-foreground group-hover:translate-x-0.5'} transition`} />
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="grid min-h-44 place-items-center px-6 text-center text-sm text-muted-foreground">
                  暂无匹配结果。可尝试搜索“中和”“实验”或切换筛选条件。
                </div>
              )}
            </div>
          </aside>
        </div>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <CircleHelp className="size-5 text-primary" />
              <h3 className="font-bold">怎样理解这份地图</h3>
            </div>
            <div className="grid gap-3 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
              <p><strong className="text-foreground">小学 51 个校区</strong>包含 45 个 2026 年户籍入学登记点、专项电脑随机录取校区，以及当年可核验民办资源。登记点不等于最终划片结果。</p>
              <p><strong className="text-foreground">初中 28 个校区</strong>包含区属划片或电脑随机录取学校、九年一贯制初中部、当年市直属招生学校和民办学校。</p>
              <p><strong className="text-foreground">点位精度分两档</strong>：校名在 OpenStreetMap 匹配到的展示实际点位；未匹配到的按所属片区近似展示，并在详情中标注。</p>
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
