# 腾讯云 COS 文件存储

业务数据在 MySQL，封面、Logo、模板 JSON 和工单附件统一使用 COS，不再需要 Supabase。沿用 `wm-1330977225`（`ap-singapore`），只写入独立目录：

```text
template-assets-v2/
  staging/{上传会话ID}/{随机文件ID}
  sealed/{上传会话ID}/{随机文件ID}
```

`staging` 是临时上传，`sealed` 是校验后的正式文件。对象不必带扩展名，Content-Type 记录真实类型。数据库仍保存相对对象 key；前缀由服务器拼接。投入使用后不要随意修改桶或前缀，否则已有对象会无法定位。

## 部署配置

```dotenv
TEMPLATE_COS_BUCKET=wm-1330977225
TEMPLATE_COS_REGION=ap-singapore
TEMPLATE_COS_PREFIX=template-assets-v2
TEMPLATE_COS_SECRET_ID=填写腾讯云服务端SecretId
TEMPLATE_COS_SECRET_KEY=填写腾讯云服务端SecretKey
TEMPLATE_ALLOWED_LEGACY_ASSET_HOSTS=wm-1330977225.cos.ap-singapore.myqcloud.com
TEMPLATE_API_ORIGIN=https://wm.timeprint.net
TEMPLATE_SHARE_ORIGIN=https://share.timeprint.net
TEMPLATE_ADMIN_ORIGIN=https://wm.timeprint.net,https://team.timeprint.net
```

继续配置有效的 `DATABASE_URL` 和两个不同的随机签名密钥 `TEMPLATE_ACTOR_HMAC_KEY`、`TEMPLATE_CURSOR_SIGNING_KEY`（各至少 32 字符）。COS SecretId/SecretKey 必须是腾讯云颁发的凭据，不能拿上述随机签名密钥替代，也不能放进 iOS。

移除旧 `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`TEMPLATE_ASSETS_BUCKET` 配置即可。安装更新后的依赖并重新部署，不需要数据库迁移。

## 对象权限与跨域

所有上传均不设置 `x-cos-acl`，新对象继承存储桶权限，由 COS 桶配置统一开放匿名读取。标准封存上传仍绑定 `x-cos-forbid-overwrite: true`；直传重试允许重复 PUT。CAM 凭据需有目标目录的 PutObject、GetObject 权限；清理脚本另外需要 ListBucket/DeleteObject。历史对象已有的显式 ACL 不会随代码更新清除，需要在 COS 控制台改为继承桶权限。

浏览器工单附件通过同源 `PUT /api/applink/v2/request-upload-sessions/{sessionID}/assets/{assetID}` 上传，携带 `X-Template-Upload-Token`，服务端校验会话、附件归属、类型、大小和 SHA256 后写入 COS。因此内置表单不依赖 COS CORS。旧的签名上传 URL 仍保留，使用它直接上传的第三方网页仍需配置 COS CORS。iOS 原生签名上传不受浏览器 CORS 限制。

## 验证和启用

```sh
# 只检查桶可访问，输出不含凭据
node --env-file=.env.local scripts/prepare-template-storage.mjs
# 在新目录写一个临时对象：验证签名上传、签名读取、匿名读取成功，最后删除测试对象
node --env-file=.env.local scripts/prepare-template-storage.mjs --apply
```

验证成功后设置所需功能开关为 `true`：`TEMPLATE_PUBLIC_ENABLED`、`TEMPLATE_PRIVATE_ENABLED`、`TEMPLATE_SEARCH_ENABLED`、`TEMPLATE_REPORT_ENABLED`，并重新部署。检查 `/api/applink/v2/capabilities`；请求头 `X-Template-Upload-Protocol: 2` 表示支持私密上传协议。

封存校验、分享过期和下架检查都保留。公开直传分享详情返回无签名 COS 地址，iOS 不持有服务端密钥。业务 API 的权限、过期与下架检查不影响已公开 COS 对象的匿名读取。旧公开文件继续使用原 COS URL，必要时复制进新目录完成资源封存；不会移动或删除旧文件。

清理脚本默认只预览；`--apply` 仅删除超过 24 小时、未提交且无引用会话对应的新目录对象，不清理已发布资源或旧目录。本次没有执行线上文件写入或清理；需要部署凭据后执行真实 COS 验证。

本地测试覆盖签名头、路径隔离、会话有效期、下载大小上限，以及真实 MySQL 的发布、封存、下架和附件关联；COS HTTP 使用测试替身。

## 批量恢复历史对象的继承权限

配置 `TEMPLATE_COS_SECRET_ID`、`TEMPLATE_COS_SECRET_KEY`，凭据需具备目标桶的 ListBucket 和目标对象的 PutObjectACL 权限。脚本将对象 ACL 设置为 `default`，默认递归处理 `TEMPLATE_COS_PREFIX`（默认 `template-assets-v2/`）下所有当前对象，包括目录占位对象，不处理历史版本。文件内容不变。

```sh
# 预览对象清单，不修改权限
node --env-file=.env.local scripts/reset-template-object-acls.mjs
# 批量恢复继承权限
node --env-file=.env.local scripts/reset-template-object-acls.mjs --apply
# 若需处理整个桶（包含旧目录），显式指定空前缀
node --env-file=.env.local scripts/reset-template-object-acls.mjs --apply --prefix=
```

脚本自动翻页，每批最多并发 5 个请求；输出成功、失败数量及失败对象键。出现失败时以非零状态退出，可重复运行重试。`default` 会恢复按目录及桶配置评估权限；若目录有独立配置，仍以 COS 实际权限为准。
