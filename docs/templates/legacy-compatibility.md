# 旧版客户端兼容与部署

旧版和新版接口同时保留，共用 MySQL 数据库和水印状态。此次修改不需要新数据库迁移。

| 旧接口 | 保留行为 |
| --- | --- |
| `POST /api/applink` | 原字段、`success/shareCode/shareLink`；新建旧版分享生成 8 位大写十六进制码；名称支持 255 字符 |
| `POST /api/applink/search` | `keyword/page/limit` 和 `results/page/perPage`；每页最多 500；恢复历史公开记录按名称、公司搜索 |
| `GET /api/applink/{code}` | `shareLink` 内保留旧版下划线字段，包含封面、JSON 地址、分享码、状态和有效期 |

旧版 `expireType`：0 永久、1 为 30 天、2 为一天、3 为一小时，`expire_time` 仍是 Unix 秒时间戳，永久为 0。新版接口继续使用 `/api/applink/v2/**`。

旧搜索继续展示正常、未过期的历史记录；新版私密分享不会出现在旧搜索中。下架、删除、过期的记录不可读取。管理操作继续要求管理员登录。旧封面和 JSON 的 COS 目录必须保留可用，允许来源继续配置 `TEMPLATE_ALLOWED_LEGACY_ASSET_HOSTS`。

## 旧域名必须继续接入

已经安装的旧 App 仍访问 `https://team.timeprint.net/api/applink/**`，修改新 App 中的域名不会改变旧 App。

1. 部署本次代码到 `wm.timeprint.net` 所用项目。
2. 将 `team.timeprint.net` 绑定到同一部署，或者将旧站的 `/api/applink` 和 `/api/applink/**` 反向代理到本服务，保留 HTTP 方法、请求体和必要请求头。不要使用会把 POST 改为 GET 的 301/302 跳转。
3. 两个域名必须访问同一个 `DATABASE_URL`。仅增加 CORS 或 `TEMPLATE_ADMIN_ORIGIN` 不会把旧 API 请求转发过来。
4. `TEMPLATE_API_ORIGIN=https://wm.timeprint.net`、`TEMPLATE_SHARE_ORIGIN=https://share.timeprint.net` 可继续沿用；两域名后台登录来源加入 `TEMPLATE_ADMIN_ORIGIN`。
5. 用旧 App 在两个域名部署后检查创建、关键词搜索、分享码导入和封面/JSON 下载；验证同一条记录下架后在两个入口都失效。

2026-09-14 检查：`wm.timeprint.net` 新版能力接口成功；`team.timeprint.net` 旧搜索可用，但新版能力接口返回 404，因此尚不能认定两个域名已使用同一部署。这一项需在部署平台完成绑定或代理后复查。

本地真实 MySQL 回归覆盖 8 位分享码、四种旧有效期、旧 DTO、历史关键词搜索、500 条分页参数、私密与下架/过期排除。COS 在本地测试中使用 HTTP 替身；不替代发布后的旧 App 实测。

## iOS 申请下架和公司需求

新版 iOS 从水印搜索页打开应用内网页 `/templates/contact?kind=removal` 或 `kind=company`；搜索框是分享码时，下架申请带入 `code`。表单通过新版 request-upload-sessions 注册、上传、完成附件，再通过 `/api/applink/v2/requests` 提交内容与附件 ID，进入后台“联系与需求”。需要同时部署本次网页改动并重新安装新版 iOS。
