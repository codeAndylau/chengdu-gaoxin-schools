# 成都高新区教育资源地图 V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有 SVG 示意分布图升级为 Leaflet + OSM 真实底图，支持香月湖周边半径查询和按街道/片区浏览。

**Architecture:** 纯函数负责距离、筛选、街道统计和地点解析，便于单测；页面组件继续管理筛选状态；Leaflet 地图作为仅客户端加载的子组件，避免 SSR 访问 `window`。南区/西区与街道边界由全部校区点位凸包加缓冲生成，明确标注为参考范围。

**Tech Stack:** React 19、TypeScript、Leaflet、react-leaflet、Vitest、现有 Tailwind/shadcn。

## Global Constraints

- 不引入高德/百度 Key；GitHub Pages 与 Vinext 入口继续共用 `components/school-map.tsx`。
- 距离使用球面直线距离；半径默认 5 公里，快捷项 1/3/5/10 公里，另提供「不限」以便查看西区。
- 默认中心为「桂溪街道香月湖」；地点解析失败不清空已选位置。
- 近似点位不得包装成精确位置；地图不是官方学区或入学资格范围。
- 本次不补电话/精确坐标、不做 URL 分享、导出、收藏、定位授权和后台。

## Files

- Create: `lib/geo.ts`, `lib/schools.ts`, `lib/places.ts`
- Create: `lib/geo.test.ts`, `lib/schools.test.ts`, `lib/places.test.ts`
- Create: `components/leaflet-school-map.tsx`
- Create: `vitest.config.ts`
- Modify: `components/school-map.tsx`
- Modify: `package.json`, `app/layout.tsx`, `pages/index.html`

---

### Task 1: 地理与筛选纯函数

**Files:**
- Create: `lib/geo.ts`
- Create: `lib/schools.ts`
- Create: `lib/places.ts`
- Test: `lib/geo.test.ts`, `lib/schools.test.ts`, `lib/places.test.ts`

- [x] 先写失败测试：球面距离、街道解析、半径筛选、预设地点匹配。
- [x] 最小实现让测试通过。
- [x] 用全部校区点位生成南区/西区/街道参考多边形。

### Task 2: Leaflet 地图

**Files:**
- Create: `components/leaflet-school-map.tsx`

- [x] OSM 底图、缩放拖拽、南区/西区参考边界、学校 CircleMarker、中心点与半径圆。
- [x] 点击点位回调选中学校；近似点位样式可区分。
- [x] 仅客户端动态加载。

### Task 3: 页面交互

**Files:**
- Modify: `components/school-map.tsx`
- Modify: `app/layout.tsx`
- Modify: `pages/index.html`

- [x] 地点搜索、半径快捷项、学段/性质/区域/街道筛选。
- [x] 周边结果按距离排序并显示距离；空状态提示调整半径。
- [x] 街道统计卡片；来源说明补充底图与参考边界。

### Task 4: 验证

- [x] `npx vitest run`
- [x] `npm run lint`
- [x] `npm run build:pages`
- [x] 浏览器核对香月湖 5 公里、街道筛选、点位详情联动。
