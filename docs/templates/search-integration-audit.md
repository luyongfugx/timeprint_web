# 新版搜索与使用计数检查（2026-09-14）

后续处理：原 883 条历史记录已完成筛选与迁移，731 条进入线上公开搜索，138 条过期排除，14 条旧资源缺失暂无法发布。下文“线上只读检查”为迁移前状态，当前结果见 [历史公开水印迁移结果](./legacy-public-migration.md)。

## 本次补齐

- 服务端搜索和工单支持 `https://share.timeprint.net/zh-Hans/share?code=...` 等语言路径，继续拒绝外域、重复 code 和非分享路径。iOS 同步识别语言路径。
- discovery 返回的申请下架／公司需求链接改为实际承载工单页面的 API 域名，默认 `wm.timeprint.net`。
- iOS 区分 `CURSOR_EXPIRED` 与水印失效；分页快照过期后重新加载第一页，避免持续重试旧游标。
- iOS 成功导入并应用历史水印后也调用 uses，不再跳过 legacy 记录。

## 计数口径

`POST /api/applink/v2/templates/{templateID}/uses` 在成功导入并应用后调用。服务端事务按模板 ID 和设备标识哈希去重，首次写入 `template_uses` 并令 `watermarks_share_links.use_count + 1`，同一设备重复调用返回 `counted:false`。

浏览详情、下载预览以及之后每次拍照不计数。私密水印也在后台记录计数，但公开接口不返回其次数。未更新的旧 App 没有这一上报逻辑，不能追溯旧使用记录。客户端当前为尽力上报，无离线队列或失败补报，因此应理解为成功收到的去重使用数。

## 线上只读检查

- wm 域名 capabilities：200，public/private、search/report 已启用。
- zh-Hans/en discovery 和关键词 search：200，当前热门词与公开结果为空。
- 数据库汇总：883 条正常历史记录均为 `contract_version=1, visibility=NULL, discovery_state=held`，尚未纳入新版公开搜索；热门词表无记录。这是数据状态，不是搜索请求失败。
- 工单页面 200；本次修复前，语言路径分享链接搜索返回 `INVALID_CODE`，需部署修复后复测。

此次没有批量公开历史水印或添加虚构热门词。要让历史数据进入新版公开列表，需确认公开范围并完成历史资源封存／发布；热门词通过后台“热门搜索词”按语言配置，未配置该语言时回退英语。

旧域名接入参见 [兼容部署说明](./legacy-compatibility.md)。本次代码需部署，iOS 需重新编译安装。完整 iOS 构建此前因磁盘空间不足未完成，尚未完成真机全流程验收。

本地验证：10 项真实 MySQL 回归、6 项服务端契约测试、11 项 iOS 网络／链接检查通过；包含历史使用去重、游标过期识别、语言链接解析和工单域名检查。COS 在本地回归使用 HTTP 替身。
