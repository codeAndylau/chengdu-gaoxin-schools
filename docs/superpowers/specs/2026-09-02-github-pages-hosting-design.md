# GitHub Pages 免费托管设计

## 目标

将现有成都高新区教育资源地图发布到免费的 GitHub Pages，获得无需登录即可访问的长期 HTTPS 地址。

## 方案

- 创建公开仓库 `chengdu-gaoxin-schools`。
- 保留现有 vinext/React 源码，并复用同一个地图组件增加纯 Vite 静态入口，生成 GitHub Pages 可直接托管的 HTML、CSS 和 JavaScript。
- 将路由入口与客户端地图组件分离，Sites 与 GitHub Pages 共用同一界面实现。
- 使用 GitHub Actions 在 `main` 分支推送后自动构建并发布 Pages。
- 配置仓库子路径 `/chengdu-gaoxin-schools`，确保静态资源在项目站点地址下正确加载。

## 边界

- 公开仓库会包含页面源码和学校数据，不包含账号令牌或临时部署凭据。
- 不改动学校名单、地图点位、筛选行为和页面视觉设计。
- GitHub Pages 的可用性取决于 GitHub 公网服务；不承诺所有网络环境均有相同速度。

## 验收

- 本地静态导出成功。
- 导出目录包含入口 HTML 与静态资源。
- GitHub Pages 部署成功并返回 HTTPS 地址。
- 以真实浏览器打开公网地址，标题、66 个校区和小学筛选结果均正常。
