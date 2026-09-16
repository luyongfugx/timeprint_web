# 热门搜索词按国家／地区配置

后台以国家／地区代码独立维护热词，例如 CN、US、HK、TW；语言相同的国家不会共用配置。

- 后台接口：`GET/PUT /api/admin/templates/trending?region=CN`，每个地区保留全部词，不设 8 个词的数量限制。
- 客户端：`GET /api/applink/v2/discovery?region=CN&locale=zh-Hans`。region 优先；旧客户端仅传 locale 时，先使用其中的地区，再使用客户端目录的语言路由，最后使用语言默认地区。
- 先查询国家配置，未找到启用词时仍兼容旧语言配置及英语回退。locale 和 region 均不改变热门水印的排序和范围。
- 数据库存储复用 `template_trending_terms.locale`，国家配置使用 `region:CN` 命名空间，避免 `ID` 国家与 `id` 语言冲突；旧语言数据保留。

## 从 gps_map_camera 导入

运行 `node --env-file=.env.local scripts/sync-trending-regions.mjs --apply`。可用 `--source=/path/to/gps_map_camera` 指定来源；不加 `--apply` 只生成本地快照。

读取 `sources/matrix/coverage.json` 的国家列表和对应 pgc 目录，优先选择该地区默认语言，其次英语；当前客户端内置和部署目录优先于原始矩阵。品牌名称保持源顺序，去重后全部保留。每个国家的来源路径、语言和词均保存在 `src/lib/templates/trending-regions.json`。

导入仅填充尚无国家配置的地区，保留后台已维护的数据。当前快照有 257 个国家／地区、3134 个词；KH、SA、TW 的源目录没有品牌词，保持为空，可在后台补充。

为已经导入过的地区补齐词：`node --env-file=.env.local scripts/sync-trending-regions.mjs --apply --append-missing`。只追加源目录中缺失的词，保留已有词、启用状态和排序；重复运行不会再次追加。
