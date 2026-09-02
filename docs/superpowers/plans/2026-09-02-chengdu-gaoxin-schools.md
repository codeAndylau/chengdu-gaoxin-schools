# 成都高新区小学与初中资源地图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可搜索、筛选并通过分布图查看成都高新区小学和初中资源的响应式网页。

**Architecture:** 使用单页 React 工作界面；学校数据保存在本地结构化文件中，地图按经纬度投影为无外部密钥依赖的 SVG 分布图。筛选条件由组件本地状态管理，地图点、列表和详情面板共享同一筛选结果。

**Tech Stack:** Vinext、React 19、TypeScript、Tailwind CSS、shadcn、Lucide。

## Global Constraints

- 数据基线为截至 2026-09-02 可核验的 2026 年招生与学校公开资料。
- 小学登记点、划片学校、民办资源和市直属资源必须区分口径。
- 无法由当前来源确认的电话或坐标必须显式标注，不得补猜。
- 页面需支持关键词、学段、性质、片区筛选，以及地图与列表联动。
- 地图用于资源分布查阅，不作为学位、划片或导航依据。

---

### Task 1: 结构化学校数据

**Files:**
- Create: `data/schools.json`
- Create: `scripts/geocode.mjs`

- [ ] 录入 2026 年小学登记点、初中招生学校和当年可核验民办学校。
- [ ] 通过公开地理编码结果补充坐标并保留坐标核验状态。
- [ ] 校验学校名称、地址、学段和来源字段完整性。

### Task 2: 交互式分布界面

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] 实现首屏概览、搜索、筛选和结果计数。
- [ ] 实现按经纬度投影的地图、点位图例及选择联动。
- [ ] 实现学校卡片、详情面板、来源说明和移动端布局。

### Task 3: 验证与交付

**Files:**
- Modify: `.openai/hosting.json`

- [ ] 运行 lint 与生产构建，修复实际失败。
- [ ] 核对关键数据计数、筛选行为和无结果状态。
- [ ] 保存版本并发布可访问网页。
