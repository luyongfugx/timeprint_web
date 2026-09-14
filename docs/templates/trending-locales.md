# 热门词语言与客户端对齐

后台主语言清单来自 `gps_map_camera/iOSTimeGPS/Resource/Language/*.lproj`，共 112 种；不使用只有 105 个归并代码的水印预设目录。快照保存在 `src/lib/templates/client-locales.json`，语言弹出层按地区分组展示，可搜索名称和代码。`en-AU` 等不在主清单中的地区代码仍可通过输入代码单独配置。

## 获取规则

热门词配置中的简体中文统一显示为“简体中文（zh-Hans）”。搜索或输入 `zh-CN`、`zh-SG`、`zh-MY`、`zh` 时选择同一个配置入口，不新增重复选项。客户端原始 112 种代码清单与读取时的精确优先兼容规则仍保留。

1. 优先查请求的精确语言；大小写不敏感，例如 `zh-hans` 与 `zh-Hans` 相同。
2. 精确语言没有启用的热门词时，按下表的别名／主语言顺序查找。
3. 最后回退 `en`；英语也没有则返回空数组。

遇到第一组非空结果即停止，最多返回 8 个，不用其他语言补足数量。全部禁用的配置视为空。简体、繁体互不回退；明确给出 Hans/Hant 时，文字体系优先于地区。

| 输入示例 | 精确未命中后的顺序（最后均为 en） |
| --- | --- |
| en-AU / en-US / en-GB / en-CA | en |
| fr-CA / fr-FR / fr-BE | fr → en |
| de-DE / de-AT / de-CH | de → en |
| es-MX / es-AR / es-419 | es → es-ES → en |
| pt-BR | pt → pt-PT → en |
| es-ES / pl-PL / sv-SE / zu-ZA | es / pl / sv / zu → en |
| zh-CN | zh-Hans → zh-SG → zh-MY → zh → en |
| zh-Hans | zh-CN → zh-SG → zh-MY → zh → en |
| zh-HK | zh-Hant → zh-TW → zh-MO → en |
| zh-Hant | zh-TW → zh-HK → zh-MO → en |
| fil-PH | fil → tl → en |
| tl-PH | fil-PH → fil → tl → en |
| iw-IL / in-ID | he-IL → he → iw → en / id-ID → id → in → en |
| no-NO | nb-NO → nb → no → en |
| kk / km / lo | kk-KZ / km-KH / lo-LA → en |
| sr-Latn-RS | sr-Latn → sr → en |
| ja-JP / ko-KR / vi-VN / th-TH | ja / ko / vi / th → en |

其他地区变体先去掉地区，再查主语言。客户端相同语言的重复地区代码（如 pl 与 pl-PL、fil 与 fil-PH）互相兼容。完整顺序由 `trendingLocaleCandidates` 定义。

## locale 仅用于热门词

- 后台列表：`GET /api/admin/templates?page=1&pageSize=20&query=哈`，不携带 locale。
- 后台热门词配置：`GET/PUT /api/admin/templates/trending?locale=zh-Hans`，编辑精确语言配置，不把回退结果冒充该语言已保存的内容。
- iOS 关键词搜索：`POST /api/applink/v2/search`，请求体不携带 locale；服务端仍接受旧客户端的字段，但不按语言筛选或绑定游标。
- `GET /api/applink/v2/discovery?locale=...` 同时返回热门词和热门水印；其中 locale **仅影响 trending**，不影响 popular。iOS 使用原始 App 语言，而不是预设目录归并后的语言。

本次还修复后台中文／Emoji 搜索 503：share_code 是 ASCII 字段，与中文关键词比较前显式转为 utf8mb4，避免 MySQL 3854 字符转换异常。不需要数据库迁移；需部署后端和前端代码，iOS 的参数调整需更新客户端。

## 同步客户端清单

```sh
node scripts/sync-client-locales.mjs /absolute/path/gps_map_camera
```

后端构建只读取仓库内 JSON，不依赖本机 iOS 工程。当前 112 种如下：

### 亚洲（46）

`ar`, `as`, `az`, `bn`, `ceb`, `dv`, `fa`, `fil`, `fil-PH`, `gu`, `he`, `hi`, `hy`, `id`, `ja`, `jv`, `ka`, `kk-KZ`, `km-KH`, `kn`, `ko`, `ku`, `ky`, `lo-LA`, `ml`, `mn`, `mr`, `ms`, `my`, `ne`, `or`, `pa`, `ps`, `si`, `ta`, `te`, `tg`, `th`, `tk`, `tr`, `ur`, `uz`, `vi`, `zh-HK`, `zh-Hans`, `zh-Hant`

### 欧洲（45）

`be`, `bg`, `bs`, `ca`, `cs`, `cy`, `da`, `de`, `el`, `en`, `es`, `es-ES`, `et`, `eu`, `fi`, `fr`, `ga`, `gd`, `gl`, `hr`, `hu`, `is`, `it`, `lb`, `lt`, `lv`, `mk`, `mt`, `nb`, `nl`, `nn`, `pl`, `pl-PL`, `pt`, `pt-PT`, `ro`, `ru`, `sk`, `sl`, `sq`, `sr`, `sv`, `sv-SE`, `uk`, `yi`

### 美洲与大洋洲（2）

`ht`, `mi`

### 非洲（19）

`af`, `ak`, `am`, `arz`, `ha`, `ig`, `mg`, `ny`, `om`, `rw`, `sn`, `so`, `st`, `sw`, `ti`, `xh`, `yo`, `zu`, `zu-ZA`
