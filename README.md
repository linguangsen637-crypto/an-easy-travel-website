<!-- ...existing code... -->
# travel-helper

A minimal example project that contains a frontend (trip list + currency converter) and a simple Node/Express backend.

一个包含前端（行程列表 + 货币转换器）和简单 Node/Express 后端的示例项目。

## Structure / 目录

- public/
  - index.html (homepage: trip list + currency converter) — 登录/注册页在 index.html 中
  - trip.html (trip details page)
  - styles.css (styles) — login/register 已居中样式
  - app.js (frontend logic)
- server/
  - server.js (backend entry)
    - db.sqlite (database file, created automatically)
- package.json (npm configuration)

## Quick start / 快速开始

1. Install dependencies:
   1. 安装依赖：
```powershell
npm install
```

2. Start the server:
   2. 启动服务器：
```powershell
npm start
```

3. Open in your browser:
   3. 在浏览器打开：
http://localhost:3000/index.html

> 说明：打开首页时默认显示居中的登录页（含切换到注册的链接），登录成功后进入主应用界面。
> Note: The homepage shows a centered sign-in form by default (with a link to switch to sign-up). After successful login the main app is shown.

## API（示例） / API (examples)

- POST /api/register — Register a user (JSON body: { email, password }) / 注册用户
- POST /api/login — Login (JSON body: { email, password }) / 登录
- GET /api/trips/:userId — Get list of trips for a user / 获取用户行程列表
- GET /api/trip/:id — Get a single trip / 获取单个行程
- POST /api/trip/:userId — Create a trip for user (body: { title, location, price, description }) / 创建行程
- DELETE /api/trip/:id — Delete a trip / 删除行程
- GET /api/rates — Static example exchange rates / 示例汇率（供前端回退）

## Notes / 备注

- Database: sqlite3 file server/db.sqlite is created automatically on first run.
  数据库：server/db.sqlite 在首次运行时会自动创建。
- If you want localized UI messages, edit `public/app.js` translations object.
  若需多语言提示，可编辑 public/app.js 中的 translations 对象。