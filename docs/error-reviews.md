# 双端错误日志 Review

## 使用

在 Codex 中手动调用 `$timeprint-error-review`，默认分析并修复北京时间昨日 00:00–24:00 的 iOS 与 Android 错误日志。技能位于 `~/.codex/skills/timeprint-error-review`，项目源文件位于 `skills/timeprint-error-review/`。修改技能源文件后复制至安装目录并运行 skill-creator 的 quick_validate.py。

平台新增菜单 **错误日志 Review**（`/dashboard/error-reviews`）：

- **每日 review**：按日期查看；同日多次 review 保留独立版本。日报包括简短结论、双端扫描/采样范围、数据缺口、重点问题与脱敏证据及 COS 定位键。
- **问题台账**：按平台、状态筛选，查看出现历史，维护负责人、修复版本、修复链接、处理原因及状态历史。
- **导入日报 JSON**：管理员可导入已审核文件；技能也可用专用 API token 发布。没有配置 token 时不阻止手动导入。

## 状态维护

新发现 → 待定位 → 已定位 → 代码已修复。完成代码修改即可，无需发布或线上验证；测试情况写入变更原因。

技能修复前先询问是否在对应 Android/iOS 当前分支修改，明确确认后执行并自动更新台账；证据不足保持待定位。修复版本和链接可选，每条修复记录写明项目、实际修改分支、路径、函数及基线 commit，标注是否已提交。保留已有负责人；每次变更必填原因，使用 version 防止覆盖并发修改。重复日报不自动覆盖状态；修复阶段通过状态 API 显式记录。历史发布/关闭状态兼容保留，当前流程不需要。

详见技能 [修复与状态同步](../skills/timeprint-error-review/references/code-fixes.md)。`npm run error-reviews:status -- change.json` 同步并读回确认。服务端需部署本次 token PATCH 支持，无新增表迁移。

## 存储与权限

使用项目已有 MySQL，新增四张表：

- `error_review_runs`：不可变日报，包含覆盖范围与脱敏证据快照；runId 幂等，相同 ID 不同内容返回 409。
- `error_review_issues`：跨日问题台账，平台化指纹作为主键。
- `error_review_findings`：日报与问题的关联和当次结论。
- `error_review_actions`：操作者、原因、前后状态和时间。

沿用现有登录与管理员权限、Origin 检查，响应 no-store。专用 token 允许读取、发布 review 和维护问题状态，记录执行仓库 Git 用户名和邮箱。不保存 COS 凭证或原始日志正文；脱敏证据仍属于内部数据，COS 对象键可能含安装标识，仅后台可访问。

## 部署与配置

先验证代码，再在目标环境新增表：

```sh
npm run error-reviews:migrate                # 只查看迁移说明
npm run error-reviews:migrate -- --apply     # 幂等创建表，不修改已有业务表
npm run build
```

配置项详见 `skills/timeprint-error-review/references/operations.md`。当前功能不会自动创建 COS 凭证或定时任务。首次启用需要：

1. 采集环境配置只读 COS 凭证和固定的 `ERROR_REVIEW_HASH_KEY`。
2. 通过 API 发布时，采集环境和 web 服务端配置相同的 `ERROR_REVIEW_API_TOKEN`；采集环境再配置 `ERROR_REVIEW_WEB_ORIGIN`。
3. 在部署环境执行迁移并发布新版 web。普通 review 不执行迁移或部署。

默认合计 50 份、上限 300 份、单文件 128 KiB、总正文 20 MiB；每端元数据至多约 20,000 条/30 页，达到边界明确标注不完整。只采集 `android_err_log_YYYYMMDD/` 和 `ios_err_log_YYYYMMDD/`，相邻日期目录用于兼容客户端时间差异；其他旧式 API 目录和反馈 runtime 需另行指定扩展范围。没有活跃/启动/拍摄分母时不报告故障率。

## 验证

`npm run test:error-reviews` 运行纯逻辑与权限合同测试；MySQL 集成测试只有设置 `ERROR_REVIEW_MYSQL_TEST=true` 且指向 127.0.0.1 的独立 `*_test` 数据库才运行。禁止把该开关用于业务库。

```sh
DATABASE_URL='mysql://root@127.0.0.1:33417/timeprint_error_reviews_test' ERROR_REVIEW_MYSQL_TEST=true npm run test:error-reviews
```

测试覆盖日期边界、跨端归因、隐私哈希、分层抽样、草稿拒收、并发幂等发布、版本冲突、状态留痕及 token 权限隔离。测试日报为合成数据，不是真实线上 review。

操作者：发布/状态脚本运行时读取执行仓库有效的 `git config user.name` 和 `user.email`（含仓库覆盖）。状态更新使用 `--repo /Users/waynelu/timeprint_android` 或 `--repo /Users/waynelu/gps_map_camera` 指定实际修改项目；日报默认使用 timeprint_web。缺少配置时停止写入，不使用历史 commit 作者或 Token 指纹冒充用户。后台保存 `git:用户名 <邮箱>`，中文通过编码请求头传输。Git 信息用于审计归属，身份认证仍由 API Token 完成；网页管理员操作仍记录登录账号。历史审计记录不改写。
