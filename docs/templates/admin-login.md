# MySQL 管理员邮箱密码登录

后台已不再调用 Supabase Auth。管理员从 `admin_accounts` 登录；会话存于 `admin_sessions`。Supabase SDK 只保留私有文件 Storage 用途。旧 `template_admins` 保留历史结构，不再决定登录或权限。

## 初始化

新库依次执行 001 分享迁移和 002 管理员迁移。已有分享库只需运行管理员迁移，不重跑 001：

```bash
# 使用具备 CREATE/INSERT 权限的数据库迁移账号：
env -u DATABASE_URL node --env-file=.env.migration.local scripts/migrate-admin-login.mjs
npm run prisma:generate
npm run build
```

或在已配置迁移账号的本地环境运行 `npm run admin:init`。首次创建默认管理员邮箱 `luyongfugx@gmail.com`，密码为用户指定的初始密码。迁移 SQL 保存 scrypt 哈希，不保存明文；重复执行不会重置已有账号密码、角色或启用状态。安装、构建、普通应用启动均不会自动插入默认账号。

完整空库 SQL 已包含 002。若直接导入该文件，不必另外初始化。

应用账号额外需要：

```sql
GRANT SELECT ON timeprint_share_wm.admin_accounts TO 'timeprint_app'@'APP_SOURCE_IP';
GRANT SELECT, INSERT, DELETE ON timeprint_share_wm.admin_sessions TO 'timeprint_app'@'APP_SOURCE_IP';
```

登录限流仍使用分享基础迁移中的 template_rate_limits，应用需有其现有读写权限。

## 登录和会话

- 页面：`/auth/v1/login`；旧 v2 登录和注册入口跳转到此页，移除 Google 登录与 OAuth 回调，没有开放注册接口。
- `POST /api/auth/login`：JSON `{email,password}`，邮箱去首尾空格并转小写。
- 密码校验：Node scrypt，N=32768/r=8/p=3，随机盐、恒定时间摘要比较。这一参数组合来自 [OWASP 密码存储建议](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)。
- 成功返回 `{user:{id,email,role}}`，设置随机 256 位会话 Cookie；数据库只存会话摘要，不存 Cookie 原文。
- Cookie：HttpOnly、SameSite=Lax、12 小时固定期限；生产 Secure，必须 HTTPS。
- `GET /api/auth/session` / `/user`：仅返回公开用户信息，不返回密码哈希、会话 token。
- `POST /api/auth/logout`：删除服务端会话并清空 Cookie。
- 页面服务端检查会话；每个管理接口再次检查。不能靠伪造 Cookie 存在绕过认证。
- 每次验证当前 enabled、role 和密码哈希版本：停用账号或修改密码立即使旧会话不可用；moderator 不能执行需 admin 的操作。
- 登录/退出/管理写请求校验 Origin。生产设置 `TEMPLATE_ADMIN_ORIGIN=https://你的后台域名`，默认允许 https://wm.timeprint.net 和 https://team.timeprint.net；本地未配置时匹配请求 URL 的 origin。
- 登录限流：同邮箱每 15 分钟最多 10 次请求，全站每 15 分钟最多 200 次请求，超限 429；无效邮箱/密码和停用账号统一提示。

## 修改密码

在权限为 600、Git 忽略的 `.env.admin.local` 中配置数据库管理连接 DATABASE_URL、ADMIN_EMAIL、ADMIN_PASSWORD（新密码 10–256 字符），执行：

```bash
env -u DATABASE_URL -u ADMIN_EMAIL -u ADMIN_PASSWORD \
  node --env-file=.env.admin.local scripts/set-admin-password.mjs
```

脚本不会创建新用户，只更新现有账号并撤销其所有会话；不输出密码或连接信息。使用完删除临时密码配置。不要把密码放在命令行参数或聊天中。

## 测试与部署范围

已通过 4 项认证测试、8 项分享数据库集成测试、6 项协议测试；生产构建、类型检查和 ESLint 无错误。浏览器使用本地测试库验证了默认管理员登录、进入水印后台、退出及未登录访问跳转。

新增认证测试覆盖错误密码、来源检查、邮箱规范化、哈希会话、登出撤销、过期、停用、改密失效、角色校验及登录限流。测试只允许明确启用的本地 *_test 库。

此次没有连接 43.156.199.205，也没有在远程库创建账号。实际部署需要先执行上述管理员迁移、增加权限，并以新版本重启后台。

## wm.timeprint.net 登录提示“请求来源无效”

在实际部署环境设置 `TEMPLATE_ADMIN_ORIGIN=https://wm.timeprint.net,https://team.timeprint.net`，然后重新部署或重启 Node.js 服务。多个允许的来源以英文逗号分隔，不填登录页路径或通配符。两个域名分别使用各自的登录 Cookie，需要分别登录。该变量同时用于登录、退出及后台写操作的来源校验；不要关闭校验。`TEMPLATE_API_ORIGIN` 是 iOS API 对外地址，不要为了修复后台登录一并修改。
