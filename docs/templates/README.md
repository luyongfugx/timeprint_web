# Timeprint 分享水印 v2 交付说明

本次实现以用户提供的 `template-platform-v2.examples.json` 和 2026-09-13 修订 3 交接文档为协议参考；按用户后续要求，**分享业务改用 MySQL，团队版代码移除，后台登录改为 MySQL 邮箱密码认证**。文件存储仍采用独立的 Supabase 私有桶，与 MySQL 数据库分开配置。

这是代码与本地验证交付，未执行生产迁移、历史数据导入、Storage 权限变更或域名部署，也未修改 iOS 仓库。

用户操作、接口顺序与存取流程见 [分享水印接口调用与数据流程](./分享水印接口调用与数据流程.md)。

## 修改内容

| 范围 | 实现 |
| --- | --- |
| API v2 | capabilities、公开/私密发布、幂等回执、按码详情、公开 ID 详情、受控 payload/图片/Logo、使用数、举报 |
| 上传 | 匿名 token 会话，逐资源 SHA-256/MIME/尺寸校验，完整解码，独立 sealed 副本，跨会话/跨用途绑定检查 |
| 原生 JSON | 保留 watermarkModel、base_id、catalogSourceBaseID、布局、未知兼容字段；仅映射已知 coverUrl/logoInfo/logoListInfo 引用；public 删除根 itemHistories；private 验证可编辑字段历史与每类最多 20 项 |
| MySQL | 事务内幂等键领取、发布与资源绑定、服务器 UTC 首次时间、精确 2,592,000 秒私密期限；bigint ID 在序列化前转字符串 |
| 搜索 | 名称/公司参数化关键词查询、新旧码/白名单链接识别、公开 eligible 过滤、热词、使用数排序、5 分钟/200 候选快照、签名游标与排除列表绑定 |
| 管理后台 | MySQL admin_accounts 权限；下架/恢复及乐观并发控制、审计、举报结案、删除/公司需求处理、热词维护 |
| 网页 | 完整等比封面、复制分享码、打开 Timeprint、App Store、公开举报、联系/公司表单、私有证据附件上传 |
| 深链 | `/.well-known/apple-app-site-association` 路由；应用 ID 与本地 Xcode 项目核对；scheme 与本地 AppDelegate 核对 |
| 旧接口 | 保留创建/详情包裹/搜索 snake_case 外形；统一 MySQL 和受控资源读取；旧 PUT 仅管理上下架，DELETE 改为审计下架；搜索最多 50 条/页，最多 200 候选 |
| 团队版移除 | teams/checkins/mobile API、创建团队/团队信息/成员/考勤页面、use-team、考勤组件、团队翻译、导航、演示账号切换；后台首页进入 watermark；本地管理员登录 |
| 构建 | 修复未注册的 Prettier ESLint 插件、lint 命令、生成文件忽略规则。旧 `.next` 为 root 所有，构建改用 `.next-timeprint`，无 sudo 或系统权限变更 |

`team.timeprint.net` 是现有 iOS API 域名，按协议保留；它不是遗留团队模块。公司模板需求是工单，也不是团队管理。

## 文件入口

- `src/app/api/applink/v2/[[...path]]/route.ts` / `src/lib/templates/routes.ts`
- `src/app/api/admin/templates/[[...path]]/route.ts` / `src/lib/templates/admin-routes.ts`
- `src/lib/prisma.ts` / `src/lib/templates/database.ts` / `repository.ts` / `transactions.ts`
- `src/lib/templates/asset-service.ts` / `payload.ts` / `legacy-assets.ts`
- `src/lib/templates/access-policy.ts` / `access-service.ts` / `search-service.ts`
- `mysql/migrations/001_template_platform.sql`
- `scripts/migrate-templates.mjs` / `prepare-template-storage.mjs` / `cleanup-template-uploads.mjs`
- `tests/templates/`：用户提供的协议 fixture、边界测试、真实 MySQL 集成测试

43.156.199.205 实例的首次部署、SQL 与后续更新步骤见 [MySQL 部署清单](../deployment/43.156.199.205-MySQL部署步骤.md)。

## Prisma 数据访问

MySQL 连接现由 Prisma Client 6.19.3 管理，运行时和维护脚本共用配置，移除 mysql2。优先使用 DATABASE_URL，为空时兼容 TEMPLATE_MYSQL_*。详细配置、模型维护与验证见 [Prisma 改造说明](./prisma.md)。

## MySQL 部署前检查

需要 **MySQL 8.0.16+ / InnoDB / utf8mb4 / UTC**。MySQL 5.7 和 MariaDB 未作为支持目标。现有 PostgreSQL 业务迁移已撤下；`docs/templates/storage-policy.sql` 仅为 Supabase Storage 的 RLS 策略，不是分享数据库迁移。

本地原仓库 `.env.local` 只有 Supabase 公钥，未提供实际 MySQL 连接或服务端 Storage key。因此生产表结构、MySQL 版本、旧数据所在库尚未验证。旧 Supabase 项目的只读 schema 请求返回 401，未取得字段/权限基线，也未读取模板记录。**切换部署前，必须将实际已有分享记录导入目标 MySQL，保留 id、share_code、created_at、expire_time、资源源 URL；否则旧码会在新库查不到。脚本不会自动跨库搬运。**

1. 将 `.env.templates.example` 所需变量写入部署秘密配置或本地 `.env.local`，不要提交密码/HMAC key/Storage key。
2. 使用专用迁移账号运行只读检查：

   ```bash
   npm run templates:preflight
   ```

   输出版本、字段名/类型，不输出用户内容。已有表检查 InnoDB、主键默认生成方式、重复码、空码/时间。已有日期必须另行确认是 UTC；脚本不会猜测旧时区或改变历史 ID。已有字符主键的字符集/排序规则会用于子表外键。新 MySQL 库没有分享表时，脚本会创建 BIGINT UNSIGNED AUTO_INCREMENT 基表。

3. 做数据库备份、确认旧字段长度/nullability/索引/权限后执行：

   ```bash
   npm run templates:migrate
   ```

   MySQL DDL 隐式提交，不能把它视为一笔可回滚迁移；中途失败须检查已创建对象再恢复。检测到已有 contract_version 会停止，避免盲目重复 ALTER。旧记录默认 contract_version=1、visibility=NULL、held，不自动进入搜索。

4. 应用运行账号只授予所需分享表的 SELECT/INSERT/UPDATE/DELETE 和视图 SELECT；不给 CREATE/DROP/ALTER/GRANT；admin_accounts 仅 SELECT，admin_sessions 仅 SELECT/INSERT/DELETE；moderation_actions 只 INSERT/SELECT。管理员名单由受控数据库管理流程写入，普通注册用户不能自授角色。
5. 执行 `npm run admin:init` 初始化管理员表及默认账号（使用迁移账号）。后台从 admin_accounts 校验邮箱、密码哈希、角色和启用状态，不再使用 Supabase Auth。部署与密码修改见 [管理员登录说明](./admin-login.md)。

## 私有存储

使用同一个已有 Supabase 项目的 server-only `SUPABASE_SERVICE_ROLE_KEY`。代码只将其用于 Storage；分享业务查询全部为 MySQL。登录不再依赖 Supabase 公钥；NEXT_PUBLIC_SUPABASE_URL 仍用于 Storage。

```bash
node --env-file=.env.local scripts/prepare-template-storage.mjs
# 审查后由部署人员创建独立私有桶：
node --env-file=.env.local scripts/prepare-template-storage.mjs --apply
```

审查现有 Storage policies；不能只看 bucket.public=false。如果存在通配 authenticated/anon 策略，按 `storage-policy.sql` 为新桶建立 restrictive 隔离，再验证 anon/普通登录用户无法直接读写。不要改变旧 COS 桶 ACL，不要删除共享旧 Logo。

注册回执的 `uploadURL` 使用 Supabase SDK 原生签名 PUT。当前 SDK 固定有效期 **2 小时**，回执如实返回这个期限；上传会话仍在 **1 小时**后失效。complete 对读到的实际字节验证摘要后上传到新的 sealed key，旧凭据不能改写 sealed。资源注册 URL 仅作引用，不提供匿名下载。

旧 public COS 输入仅允许 `TEMPLATE_ALLOWED_LEGACY_ASSET_HOSTS` 中的精确域名和 `/ugc_cover/`、`/ugc_json/`、`/ugc_logo/` 文件路径；域名白名单默认空。https、无用户信息、无非标准端口，拒绝重定向，DNS 公网 IPv4 校验并固定连接地址，下载上限和超时。private 必须使用上传会话，不能把旧公开 URL 包装成私密。

清理脚本默认 dry-run，仅在 --apply 时回收超过 24 小时的无引用、未提交会话资源及过期搜索快照。已发布/已关联工单资源和旧 COS 不自动删除。生产需要另行安排定时执行和保留策略；本次没有创建自动任务。

## 功能开关与客户端

所有开关默认关闭。按 `REPORT → PUBLIC → PRIVATE → SEARCH` 的依赖顺序联调后开启。未完成 MySQL、Storage、管理员配置时不要开启。未带 `X-Template-Upload-Protocol: 2` 的客户端 capabilities 最多得到 public；即使客户端伪造这个头，private 创建仍要求匹配的 session/token。

本地 iOS 源码已存在 `timeprint://template?code=` 处理，App ID 在 Xcode 项目核对为 `A4MAJNXUQY.com.timestampcamerafree.gpsmapcameratimemark.geotagginglocationonphoto`。App Store ID `6480020509` 来自本地客户端评价模块和 App Store metadata 文档。**本机 entitlement 仍只列 www.timeprint.net，与交接文档描述有差异**；iOS 实施方需核对实际交付分支是否包含 share.timeprint.net，以及 protocol 2 上传适配。未经真实客户端验证，不将 Private 开关开放给旧 COS 上传链路。

`TEMPLATE_API_ORIGIN=https://team.timeprint.net`、`TEMPLATE_SHARE_ORIGIN=https://share.timeprint.net` 保持与 iOS 固定合同一致。两个域名的 `/api/applink/v2` 均需反代到此服务。share 域名的 AASA 必须 HTTPS 200、无重定向；App 关联域名、冷/热启动和 Safari 同域唤起需要真机联调。

## HTTP 与隐私约束

- 错误为 `{error:{code,message,retryable,requestID}}`，不返回底层 MySQL/Storage 错误文本。
- v2 no-store / no-referrer / nosniff；网页 noindex；不生成私密社交封面。
- private 和 legacy unknown 只能持正确码读取，ID、assetID 单独访问为 404；下架/到期为 410；public 的历史有效期仍按旧 expire_time。
- 管理 API 验证 MySQL admin_sessions 和 admin_accounts；Cookie 为 HttpOnly，同源写入校验，账号停用/改密立即失效。Cookie 写请求必须匹配 TEMPLATE_ADMIN_ORIGIN；生产默认 https://team.timeprint.net。API 不依赖页面登录中间件作为权限保护。
- 配置 TEMPLATE_TRUSTED_IP_HEADER 前，反代必须剥离并重写该头。不设置时使用全局宽限额及安装级限额；它不等于可靠的 IP 限流。
- 应用没有输出请求体/码/上传 token 的日志。生产反代/CDN/错误追踪须自行禁止记录私密 code query、body、资源 URL、联系方式；Next 开发访问日志不适合作生产私密日志。
- 转发直接使用原链接；restore 不续期；后台不允许原地换已发布 payload、URL、visibility 或有效期。无法撤回收件人已保存的本地模板。

## 测试与已验证范围

```bash
npm run test:templates
# 仅限独立的本地 *_test 数据库；会清理此测试库内的分享测试记录：
TEMPLATE_MYSQL_TEST=true TEMPLATE_MYSQL_HOST=127.0.0.1 \
TEMPLATE_MYSQL_PORT=33316 TEMPLATE_MYSQL_USER=root \
TEMPLATE_MYSQL_DATABASE=timeprint_templates_test npm run test:templates:mysql
npm run lint
npm run build
```

最终验证：13 项测试全部通过，生产构建通过，全项目 ESLint 无 error，`git diff --check` 通过。

集成测试使用真实 MySQL 8.0.30；Storage 使用 HTTP 合同测试替身，并非线上 Supabase 实测。覆盖 20 并发发布只有一个回执/记录、20 并发使用只计一次、改 staging 不改 sealed、错误 token/跨 session、public 历史删除/private 保留、期限边界、恢复不续期、举报下架、请求幂等、证据归属、游标签名/稳定分页、JSON 摘要、错误合同，并验证超过 JavaScript 安全整数范围的 bigint ID 与旧接口包裹兼容。

浏览器验证：分享缺码状态、联系删除入口、公司需求表单切换。HTTP 验证：无配置 capabilities 返回空范围、未登录管理请求 401、AASA JSON 200、已移除 teams/checkins/mobile 路由 404。没有真实用户数据、生产部署、真实 Storage ACL 或 iOS 相机导入链路的验证结论。

生产上线尚需：实际 MySQL schema/旧数据基线与导入、服务账号和管理员配置、私有桶及策略验证、可信代理限流/日志脱敏、两个域名路由/AASA、iOS 上传协议与真机端到端验收。
