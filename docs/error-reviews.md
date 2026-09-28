# 双端错误日志 Review

## 使用

在 Codex 中手动调用 `$timeprint-error-review`，默认分析北京时间昨日 00:00–24:00 的 iOS 与 Android 错误日志。技能位于 `~/.codex/skills/timeprint-error-review`，项目源文件位于 `skills/timeprint-error-review/`。修改技能源文件后复制至安装目录并运行 skill-creator 的 quick_validate.py。

平台新增菜单 **错误日志 Review**（`/dashboard/error-reviews`）：

- **每日 review**：按日期查看；同日多次 review 保留独立版本。日报包括简短结论、双端扫描/采样范围、数据缺口、重点问题与脱敏证据及 COS 定位键。
- **问题台账**：按平台、状态筛选，查看出现历史，维护负责人、修复版本、修复链接、处理原因及状态历史。
- **导入日报 JSON**：管理员可导入已审核文件；技能也可用专用 API token 发布。没有配置 token 时不阻止手动导入。

## 状态维护

新发现 → 待定位 → 已定位 → 已修复待发布 → 已发布待验证 → 已关闭。

排查阶段可以明确忽略并填写原因。修复后发现复发、关闭后收到新证据时可回到待定位。每次修改必填原因，修复/验证/关闭必填修复版本；关闭时应说明验证机型、版本及证据，不仅写“今天没有日志”。并发修改用 version 检查，冲突返回 409，不覆盖他人修改。

新日报只增加观察记录、更新首次/最近出现日期，不自动覆盖人工状态。问题指纹改变时不会自动合并，需先确认是否为同一个根因。多份日报的重叠样本不能累加为独立故障。

## 存储与权限

使用项目已有 MySQL，新增四张表：

- `error_review_runs`：不可变日报，包含覆盖范围与脱敏证据快照；runId 幂等，相同 ID 不同内容返回 409。
- `error_review_issues`：跨日问题台账，平台化指纹作为主键。
- `error_review_findings`：日报与问题的关联和当次结论。
- `error_review_actions`：操作者、原因、前后状态和时间。

沿用现有登录与管理员权限、Origin 检查，响应 no-store。专用 token 只允许读取和发布 review，无权限维护问题状态。不保存 COS 凭证或原始日志正文；脱敏证据仍属于内部数据，COS 对象键可能含安装标识，仅后台可访问。

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
