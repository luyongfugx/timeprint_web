# 运行与配置

## 平台

- 页面：`<ERROR_REVIEW_WEB_ORIGIN>/dashboard/error-reviews`，登录原有管理员账户。
- API：`/api/admin/error-reviews`。GET 列表支持 `?date=YYYY-MM-DD`；GET `/:runId` 返回日报与当前台账；GET `/issues?status=&platform=&page=1` 返回台账；GET `/issues/:fingerprint` 返回状态与出现历史。
- 技能调用 API 使用 `Authorization: Bearer <ERROR_REVIEW_API_TOKEN>`；此 token 可读取、发布日报及 PATCH 问题状态，变更操作者记录为 git:用户名 <邮箱>。管理员会话仍校验管理后台 Origin。两种入口都要求 version 和变更原因。
- Publish 脚本超时 60 秒，禁止重定向以免凭证泄漏。发布失败保持文件与 runId，再重试同一内容。

## 环境（web 的 .env.local 或当前进程，绝不提交）

- `ERROR_REVIEW_COS_SECRET_ID` / `ERROR_REVIEW_COS_SECRET_KEY`：只读日志目录权限；临时凭证可设 `ERROR_REVIEW_COS_SESSION_TOKEN`。不从客户端源码提取内置密钥。
- `ERROR_REVIEW_HASH_KEY`：至少 32 字符随机固定密钥，为设备/会话生成稳定 HMAC；不要每日更换，否则跨日去重失效。
- Android 默认桶 `timeprintandroid-1330977225`、iOS 默认桶 `tplog-1330977225`，默认 region `ap-singapore`；可用 `ERROR_REVIEW_ANDROID_BUCKET/REGION`、`ERROR_REVIEW_IOS_BUCKET/REGION` 覆盖。
- `ERROR_REVIEW_WEB_ORIGIN`：已有 timeprint_web 部署地址（HTTPS；仅本地允许 HTTP）。
- `ERROR_REVIEW_API_TOKEN`：至少 32 字符随机密钥，发布端与 web 服务端一致。不要复用 COS 密钥。平台导入 JSON 不需要此 token。

## 首次平台安装（仅尚未安装时）

代码维护在 timeprint_web。现有 MySQL 配置沿用项目 DB 配置。`npm run error-reviews:migrate` 仅预览；确认部署目标后 `npm run error-reviews:migrate -- --apply` 增加四张表，不改旧表。普通每日 review 不执行迁移、不自行部署。没有表或服务不可用时保留本地日报并明确报错。

## 示例

```sh
cd /Users/waynelu/timeprint_web
npm run error-reviews:collect -- --max-samples 50
# 输出 directory 后，对其中 review.json 分析补齐；不直接发布待分析草稿。
npm run error-reviews:publish -- .error-reviews/<date>/<run>/review.json --validate
npm run error-reviews:publish -- .error-reviews/<date>/<run>/review.json
# 明确指定已结束的历史日期
npm run error-reviews:collect -- --date 2026-09-27 --max-samples 100
```

获取既有台账时使用项目 Node 脚本读取环境、通过 fetch 添加 Authorization，并仅输出业务响应；不要把 token 拼入终端命令、URL 或日志。平台已有问题数量较多时按页读取，并记录读取范围。

## 自动维护状态

读取 GET /issues/:fingerprint 获取当前 version、负责人及修复信息，然后创建状态文件：

```json
{"issueId":"64位问题指纹","change":{"version":1,"status":"investigating","owner":"Codex","fixVersion":"","fixLink":"","note":"日报 runId；证据与排查计划"}}
```

`npm run error-reviews:status -- <change.json> --validate` 只校验，去掉 `--validate` 后 PATCH 并读回状态/审计记录。修复结束时 status=fixed，note 必须写项目、实际修改分支、代码路径、改动依据、当前 commit 基线/未提交状态及测试结果；fixVersion、fixLink 可空，不为状态操作编造版本或提交。

旧版服务拒绝 token PATCH 时，明确需要部署新版 web，不退回数据库直写或借用管理员账号。普通 review 不部署。网络结果不确定时先读回历史：若期望 version+1 和变更原因已存在则视为成功；否则重新评估，最多重试两次。409 不能自动改 version 强行重放。

操作者：发布/状态脚本运行时读取执行仓库有效的 `git config user.name` 和 `user.email`（含仓库覆盖）。状态更新使用 `--repo /Users/waynelu/timeprint_android` 或 `--repo /Users/waynelu/gps_map_camera` 指定实际修改项目；日报默认使用 timeprint_web。缺少配置时停止写入，不使用历史 commit 作者或 Token 指纹冒充用户。后台保存 `git:用户名 <邮箱>`，中文通过编码请求头传输。Git 信息用于审计归属，身份认证仍由 API Token 完成；网页管理员操作仍记录登录账号。历史审计记录不改写。
