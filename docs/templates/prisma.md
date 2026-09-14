# Prisma 数据库接入说明

本次将 MySQL 连接和事务交给 Prisma Client 6.19.3，移除 mysql2。数据库仍为 MySQL 8.0.16+；后台认证现在使用 MySQL 管理员表，文件存储已改为腾讯云 COS 独立目录。本次未连接或迁移生产库，也未导出 Supabase。

## 代码结构

| 文件 | 职责 |
| --- | --- |
| `prisma/schema.prisma` | 从独立 MySQL 8.0.30 测试库反向生成的 14 张业务表模型，包含字段、索引与外键 |
| `src/lib/prisma.ts` | 服务端延迟初始化的 Prisma Client，全局复用连接池，避免开发热更新反复创建 |
| `scripts/lib/database-config.mjs` / `prisma.mjs` | Web、维护脚本及 CLI 共用连接配置；客户端创建独立于 CLI，支持首次生成 |
| `src/lib/templates/database.ts` | 参数化 SQL 查询、交互式事务、错误映射及 HTTP 数据序列化 |
| `scripts/prisma.mjs` | Prisma CLI 入口，支持无真实连接配置的 generate/validate |

管理员身份表查询、热词列表使用生成的模型 API，例如 `database().admin_accounts.findUnique()`、`database().template_trending_terms.findMany()`。分享发布、搜索排序、行锁及现有视图读取保留参数化 SQL，通过 Prisma `$queryRawUnsafe(sql, ...values)` / `$executeRawUnsafe(sql, ...values)` 执行；SQL 模板只来自服务端代码，请求值始终作为参数单独传入。参考 [Prisma 参数化原生查询说明](https://www.prisma.io/docs/orm/v6/prisma-client/using-raw-sql/raw-queries)。

事务使用 `$transaction`，连接内设置 UTC；等待事务连接和事务执行期限均为 30 秒。死锁、锁等待及事务超时映射为可重试的 REQUEST_IN_PROGRESS。Prisma BigInt 转为字符串，Date 转为 UTC ISO 时间，JSON 保留结构，避免 HTTP JSON 序列化失败或 ID 丢精度。

## 配置连接

推荐在 `.env.local` 或部署秘密配置中设置：

```dotenv
DATABASE_URL="mysql://USER:ENCODED_PASSWORD@HOST:3306/timeprint_share_wm?connection_limit=10&pool_timeout=30&sslaccept=strict"
```

用户名和密码中的特殊字符应 URL 编码；私有 CA 可通过 `sslcert` 指定绝对证书路径。TLS 参数以数据库提供商配置为准，参考 [Prisma MySQL 连接文档](https://docs.prisma.io/docs/orm/v6/overview/databases/mysql)。不要把 URL、密码提交到 Git 或输出到日志。

DATABASE_URL 非空时优先使用该完整配置；为空时继续支持 TEMPLATE_MYSQL_HOST、PORT、DATABASE、USER、PASSWORD、SSL。旧配置的 SSL=true 映射为 sslaccept=strict；旧字段中的用户名/密码由代码编码。不需要为了这次改造立即重写已有环境变量。

应用只有首次查询才初始化连接，没有数据库配置时仍能生成客户端和构建。普通安装的 postinstall 和 build 会生成客户端，不会建表、修改结构或连接生产库。当前项目使用 Node 22；脚本的 `--env-file-if-exists` 需要支持该参数的 Node 版本。

## 常用命令

```bash
npm run prisma:generate   # 生成客户端，不连接数据库
npm run prisma:validate   # 校验模型，不连接数据库
npm run prisma:pull       # 从已配置数据库读取表结构，更新本地 schema
npm run prisma:studio     # 打开数据库管理界面；其中编辑操作会修改所连接的数据
```

Prisma CLI 默认使用用户目录 `.cache/timeprint-prisma` 作为独立缓存；已设置 XDG_CACHE_HOME 时沿用配置，避开本机旧 root 所有缓存。CLI 自动加载 `.env.local`，与应用采用同一连接解析逻辑。

## 数据结构与迁移

这次接管的是数据库访问层，不将已有 SQL 迁移历史自动改写为 Prisma Migrate。建库/升级继续使用：

```bash
npm run templates:preflight
npm run templates:migrate
```

脚本内部已改为 Prisma 执行，仍保留预检查和显式 --apply。SQL 文件继续维护 CHECK 约束、生成列、两个视图和旧主键类型适配，这些信息不能仅靠 Prisma 模型完整还原。

**不要直接对现有库执行 prisma db push、migrate reset 或未经基线检查的 migrate dev。** 当前没有 Prisma migration history；若后续要采用 Prisma Migrate，应先建立经审核的生产结构基线，保留自定义 SQL 对象。

提交的 schema 已随旧数据兼容迁移改为 CHAR(36) UUID 主键，历史名称容量为 255 字符；新版发布参数仍限制名称 100 字符。新建空库在 001/002 后还需执行 003 UUID 兼容迁移（完整空库 SQL 已包含）。若实际历史库采用其他 ID 类型或字段结构，部署前需要核对并按目标结构重新 pull/generate；不要把测试模型当作已经验证的生产结构。仅运行 generate 不会更改数据库。

`cleanup-template-uploads.mjs` 也已改用 Prisma，默认仍为 dry-run；文件清理成功后才在 Prisma 事务中清理关联的无引用记录。

## 验证

已在独立的本地 MySQL 8.0.30 测试库完成：

- 6 项协议测试和 8 项 MySQL 集成测试全部通过。
- 覆盖并发发布/使用去重、私密期限、资源关联、分页、审核、旧接口兼容。
- 新增 Prisma 参数绑定、事务回滚、BigInt/日期/JSON 返回值及生成模型读取测试。
- 新建空测试库经 Prisma 执行完整 SQL 迁移成功；清理脚本 dry-run 通过。
- DATABASE_URL 和旧 TEMPLATE_MYSQL_* 两种配置均通过集成测试。

测试使用 Storage HTTP 替身，不代表生产 Storage 或真实 iOS 联调已验证。
