# GitHub Pages Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将成都高新区教育资源地图免费发布到 GitHub Pages，并验证公网访问。

**Architecture:** vinext 继续负责现有 React 页面构建，通过静态导出生成无需服务器运行时的站点文件。GitHub Actions 上传静态产物并部署到项目 Pages 地址。

**Tech Stack:** React 19、vinext、GitHub Actions、GitHub Pages

## Global Constraints

- 公开仓库名称固定为 `chengdu-gaoxin-schools`。
- 页面部署在仓库子路径 `/chengdu-gaoxin-schools`。
- 不修改学校数据、页面内容或交互逻辑。
- 不向仓库写入任何登录令牌或临时凭据。

---

### Task 1: 静态导出配置

**Files:**
- Create: `vite.pages.config.ts`
- Create: `pages/index.html`
- Create: `pages/main.tsx`
- Modify: `package.json`
- Modify: `app/page.tsx`
- Create: `components/school-map.tsx`

**Interfaces:**
- Consumes: 现有 React 地图组件和全局样式。
- Produces: `out/index.html`、`out/assets/**` 和公开图标资源。

- [ ] **Step 1: 添加静态入口与子路径配置**

在 `vite.pages.config.ts` 中设置静态入口、输出目录 `out` 和基础路径 `/chengdu-gaoxin-schools/`。

将现有客户端地图组件移动到 `components/school-map.tsx`，由 Sites 的 `app/page.tsx` 与 GitHub Pages 的 `pages/main.tsx` 分别渲染。

- [ ] **Step 2: 添加静态构建命令**

在 `package.json` 中增加 `build:pages`，执行 `vinext build`。

- [ ] **Step 3: 验证静态构建**

Run: `npm run build:pages`

Expected: 退出码为 0，并生成 `out/index.html`。

### Task 2: GitHub Pages 自动发布

**Files:**
- Create: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: `npm ci`、`npm run build:pages` 和 `out/`。
- Produces: GitHub Pages 生产部署。

- [ ] **Step 1: 添加 Pages 工作流**

工作流在 `main` 推送和手动触发时运行，授予 `pages: write` 与 `id-token: write`，上传 `out/` 后调用官方 `deploy-pages` action。

- [ ] **Step 2: 本地检查工作流与构建**

Run: `npm run build:pages && test -f out/index.html && git diff --check`

Expected: 退出码为 0。

### Task 3: 创建公开仓库并验证

**Files:**
- No source changes.

**Interfaces:**
- Consumes: GitHub 登录状态和已验证的提交。
- Produces: `https://<user>.github.io/chengdu-gaoxin-schools/`。

- [ ] **Step 1: 登录 GitHub**

Run: `gh auth login --hostname github.com --git-protocol https --web`

Expected: `gh auth status` 显示已登录。

- [ ] **Step 2: 创建公开仓库并推送**

Run: `gh repo create chengdu-gaoxin-schools --public --source=. --remote=github --push`

Expected: 远端 `main` 指向当前提交。

- [ ] **Step 3: 启用并等待 Pages 工作流**

Run: `gh run watch --exit-status`

Expected: 部署工作流结论为 `success`。

- [ ] **Step 4: 浏览器验收**

打开 Pages HTTPS 地址，确认页面标题为“成都高新区教育资源地图”、显示 66 个校区，并验证“小学”筛选得到 51 个结果。
