# Firebase Crashlytics 数据源

使用官方只读 REST v1alpha：先 GET `projects/{project}/apps/{app}/reports/topIssues`，再带 `filter.issue.id` 调用 GET `projects/{project}/apps/{app}/events`，按 `filter.interval.startTime`（含）、`filter.interval.endTime`（不含）筛选北京时间昨日。Android 分别取 FATAL/ANR，iOS 取 FATAL；NON_FATAL 不在默认范围。ANR 是 Android 类型，不把 iOS 崩溃称为 ANR。

本机 .env.local 配置：
- ERROR_REVIEW_FIREBASE_CREDENTIALS：服务账号 JSON 文件的绝对路径，仅采集端需要。私钥不上传 web、不提交 Git、不输出日志。
- ERROR_REVIEW_FIREBASE_IOS_CREDENTIALS / ERROR_REVIEW_FIREBASE_ANDROID_CREDENTIALS：可选的分端 JSON 路径，优先于共用凭证；用于双端独立服务账号。
- ERROR_REVIEW_FIREBASE_ANDROID_RESOURCE：从正式版 google-services.json 核对，当前为 projects/sample-firebase-ai-app-c6fb2/apps/1:401431549807:android:95b938e59c92c3eb8efa9a。
- ERROR_REVIEW_FIREBASE_IOS_RESOURCE：从 GoogleService-Info.plist 核对，当前为 projects/timegps-201a4/apps/1:987439760391:ios:cdc8cf391dfe6f1b2d56a2。

两个应用属于不同项目。OAuth 成功不等于具有 Crashlytics 数据权限。需启用 firebasecrashlytics.googleapis.com，并为该服务账号在目标项目授予 Crashlytics 读取权限（如 Firebase Crashlytics Viewer；不要授予 Editor 仅为读取）。支持共用密钥跨项目授权，也支持双端独立密钥。当前已配置双端独立 JSON；2026-09-28 授权后双端 topIssues 查询均成功。

不自行修改云端 IAM、启用服务或转而抓取控制台隐藏接口。

## 采集与预算

先 COS `--max-samples 25`，再 `npm run error-reviews:firebase -- <COS草稿.json> --max-samples 25`。脚本在原目录产生带新 runId 的 firebase-*.json，不覆盖已发布日报；之后分析并审核此新草稿，再 validate/publish。拒绝对已含 Firebase 的草稿重复扩样。

Firebase 25 份分配到 Android FATAL / ANR / iOS FATAL 三组，每组先列一页 topIssues，最多读取分配额度个 issue，每个读取窗口内最新 1 份事件；不代表完整排名或全量。每个响应最多 4 MiB，请求 15 秒超时。三组均尝试，单个 issue 失败不阻止其他 issue，失败的配额不自动转移至其他来源。已有当天 COS 50 份时先复用，不能悄悄再加 25；需要扩样时先说明增量成本并获得明确范围。

readMask 排除 user、customKeys、logs、breadcrumbs。仅保留事件/issue 来源、脱敏异常栈、版本、机型、系统、按 Firebase 应用隔离的安装/会话 HMAC。最多保留 8 个线程/异常、每个 30 帧，优先 blamed/crashed/main，最终栈截取 6000 字符，可能缺锁持有线程；不得把截断样本当作完整 ANR 因果链。

firebaseCoverage 的 listed 是 API 实际返回事件数，downloaded 是已读取事件数，failed 是失败请求数，不是全天总事件/用户数。分页未读取标记 limited，权限/格式/初始化失败标记 listingComplete=false，并在日报明确说明。事件时间再次本地验证，其他日期不纳入。迟到数据需另次 review 才覆盖。

按 Firebase 项目+app+issue ID 生成独立指纹，来源资源存于 objectKey、source=firebase，绝不伪装 COS 文件路径。与 COS 疑似重复时只做文字关联，不跨来源合并设备/事件数量。台账只维护 timeprint_web，代码修复不关闭或静默修改 Firebase issue。

文档：
- https://firebase.google.com/docs/reference/crashlytics/rest
- https://firebase.google.com/docs/reference/crashlytics/rest/v1alpha/projects.apps.events/list

启用入口：
- Android：https://console.cloud.google.com/apis/library/firebasecrashlytics.googleapis.com?project=sample-firebase-ai-app-c6fb2
- iOS：https://console.cloud.google.com/apis/library/firebasecrashlytics.googleapis.com?project=timegps-201a4

2026-09-28 授权后验证（北京时间 2026-09-27 窗口）：Android FATAL 与 ANR 各取 1 份，已通过实际采集脚本完成解析与草稿校验，failed/unparsed 均为 0。iOS topIssues 查询成功但返回空，尚无真实 iOS 事件验证解析；不将此结果推广为其他日期或所有错误类型均无错误。本次仅生成本地验证草稿，未发布日报。

接入注意：直接 events 请求缺少 issue.id 会返回 400，应先列 issue 再取事件。事件资源可能将配置的项目 ID 转为数字项目编号；校验须保持 app ID 完全一致，且数字项目编号必须等于 app ID 内的项目编号，不能接受任意项目。
