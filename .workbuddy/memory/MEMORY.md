# MEMORY.md — timeprint_web 项目长期笔记

## 部署与域名
- `wm.timeprint.net` 就是本仓库的部署（可用 `GET /api/applink/v2/capabilities` 探测：线上返回值与本地代码一致）。
- 旧 App 仍访问 `team.timeprint.net/api/applink/**`，必须绑定到同一部署或反向代理，且共用同一 `DATABASE_URL`。

## 线上取证手段
- `.env.local` 的 `DATABASE_URL` 指向线上 MySQL（43.156.199.205）。可用只读查询做线上取证：
  `/opt/anaconda3/bin/mysql -h 43.156.199.205 -u timeprint_app -p... --ssl-mode=REQUIRED timeprint_share_wm -e "..."`
- 库里所有 `created_at` 都是 UTC，日志时间是 UTC+8，排查时先换算。
- 判断请求走到哪一步的快捷表：`template_upload_sessions.state`（open/ready/committed）、
  `template_assets`（staging/sealed）、`watermarks_share_links`。

## 日志约束
- 不要把完整私密 URL、分享码、上传 token、用户文件内容写进日志；只记 host 与文件名、错误 code/status。
- 旧版接口 `POST /api/applink` 的错误响应只有一句通用文案，根因必须靠服务端日志（`logFailure`）。

## 本地脚本
- `scripts/diagnose-legacy-applink.ts`：不依赖 DB/COS 凭据复现旧版资源链路，用于区分 COS 网络问题与代码问题。
  运行：`TEMPLATE_ALLOWED_LEGACY_ASSET_HOSTS=<host> node --conditions=react-server --import tsx scripts/diagnose-legacy-applink.ts <coverURL> <jsonURL>`
- 服务端模块（`server-only`）在脚本里要用 `node --conditions=react-server --import tsx` 才能导入。
