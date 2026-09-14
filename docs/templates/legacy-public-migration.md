# 历史公开水印迁移结果（2026-09-14）

已直接处理生产 MySQL `timeprint_share_wm`，使用部署在 `wm.timeprint.net` 的新版签名上传与封存接口。

| 原 883 条历史记录 | 数量 | 结果 |
| --- | ---: | --- |
| 正常、未过期且资源完整 | 731 | 已设为 public / eligible，线上新版搜索已生效 |
| 已过期 | 138 | 保留原状态与有效期，不进入搜索 |
| 旧 COS 资源缺失 | 14 | 保持 held；9 条 JSON 也缺失，另外 5 条缺封面 |

ID、分享码、名称、公司、创建时间、原有效期均保留。每条成功记录先校验封面、Logo、JSON，将公共版本移除 itemHistories 后封存至 `template-assets-v2/`，再通过现有审批事务绑定资源、设置公开范围并写审计。没有延长有效期，没有把新版私密记录改成公开，没有删除旧 COS 对象。

这次同时修复了旧资源 URL 的兼容范围：支持 Unicode 字母／数字文件名（旧客户端会生成阿拉伯数字日期），以及项目原有的 `wm_logo` 内置 Logo 目录。仍只允许配置中的 HTTPS COS 主机、限定目录和单个文件名；编码路径分隔符、双重编码和其他目录仍被拒绝。补齐了历史 NULL 有效期作为永久的搜索判断。这些代码修改需随项目发布；731 条数据发布已在线上生效。

## 验证

- 生产汇总：731 条 public/eligible，152 条 held，其中 138 条已过期。
- 线上 discovery 连续两页各 20 条，无重复；抽查关键词、按 ID 与分享码读取、封面下载成功。
- 抽查 JSON 的 X-Payload-SHA256 与实际字节一致，公开版本不含 itemHistories。
- 11 项真实 MySQL 回归、6 项契约测试通过，包括公开迁移后可搜索、原身份与有效期保持、下架后退出搜索、旧资源 URL 路径约束。

## 脚本与恢复后重跑

`scripts/publish-legacy-shares.mjs` 默认只预览。需要 Node 24、项目依赖和 `.env.local` 中具有维护权限的数据库连接。执行时校验指定管理员账号仍启用且为 admin；通过独立维护上传会话取得服务器签名，不把 COS 密钥取到本机。

```sh
node --env-file=.env.local --conditions=react-server --import tsx scripts/publish-legacy-shares.mjs

node --env-file=.env.local --conditions=react-server --import tsx scripts/publish-legacy-shares.mjs \
  --apply --admin-email luyongfugx@gmail.com --concurrency 8 \
  --report /absolute/path/new-migration-report.json
```

每次必须使用新的报告路径，避免覆盖原始检查点。报告以 0600 权限保存变更前字段、上传会话 ID、结果和变更后字段，不保存令牌或凭据。已成功公开的记录自动跳过，失败时保留 held；存在失败时退出码为 2。可追加 `--retry-report /absolute/path/previous-report.json` 仅重试该报告中的失败项。待 14 条旧资源从备份恢复后，可以重跑；不要伪造或用无关封面替代原资源。

本次记录保存在本机 Downloads 的 `timeprint-legacy-public-*-20260914.json`，缺失资源状态清单为 `timeprint-legacy-missing-assets-20260914.json`。中断或失败会话的未提交对象沿用现有超过 24 小时的清理规则，不影响已发布文件。
