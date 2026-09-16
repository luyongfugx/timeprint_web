# 国家／地区热门搜索词清单

生成日期：2026-09-16。本文记录本次导入的数据快照，后续后台编辑不会自动更新本文。

共 **257 个国家／地区**，其中 **254 个有关键词**，共 **3134 个关键词配置项**（不同地区可能使用相同词）。

数据依据：`src/lib/templates/trending-regions.json`，来源为 `gps_map_camera` 中的地区目录。按源目录品牌名称顺序去重，保留全部词；当前客户端及部署目录优先于原始矩阵。表内顺序即配置顺序。源数据没有品牌词的地区标为“暂无关键词”。

本次数据已写入当前配置数据库并核对；代码尚未部署。

## 本次修改文件

| 类型 | 文件 | 修改内容 |
| --- | --- | --- |
| 修改 | `src/app/(main)/dashboard/watermark/page.tsx` | 热门词页面改为国家／地区选择，默认 CN；读取和保存使用 region 参数，并防止旧请求覆盖新选择。 |
| 替换 | `src/app/(main)/dashboard/watermark/region-picker.tsx` | 替代原 language-picker.tsx；支持搜索国家／地区中文名、英文名和代码。 |
| 新增 | `src/lib/templates/trending-regions.json` | 保存 257 个国家／地区的关键词、语言、源文件路径以及语言到地区的映射。 |
| 新增 | `src/lib/templates/trending-regions.ts` | 校验地区代码，并为旧客户端将语言参数解析为对应地区。 |
| 修改 | `src/lib/templates/admin-routes.ts` | 后台热门词 GET/PUT 使用 region 参数；以 region:XX 命名空间保存到原热词表。 |
| 修改 | `src/lib/templates/contracts.ts` | 列表接口契约增加可选 region 参数并校验、规范化。 |
| 修改 | `src/lib/templates/routes.ts` | discovery 接口读取并传递 region 查询参数。 |
| 修改 | `src/lib/templates/search-service.ts` | 优先读取国家／地区热词，并保留旧语言热词回退。 |
| 新增 | `scripts/sync-trending-regions.mjs` | 从 gps_map_camera 生成快照并批量导入；保留已有国家配置。 |
| 修改 | `tests/templates/contracts.test.ts` | 增加国家代码校验、语言映射、去重和超过 8 个词的回归检查。 |
| 修改 | `docs/templates/trending-locales.md` | 更新国家／地区配置、接口、存储方式和导入流程说明。 |
| 新增 | `docs/templates/trending-region-keywords.md` | 本文件：修改清单及全部国家／地区的关键词。 |

原 `src/app/(main)/dashboard/watermark/language-picker.tsx` 已由 `region-picker.tsx` 替代。没有新增数据库表或修改 Prisma schema；国家配置复用 `template_trending_terms.locale` 字段，以 `region:CN` 等值区分旧语言配置。

另同步修改 GPS 客户端 `iOSTimeGPS/UI/Watermark/Catalog/TimeprintCatalogExploreViewController.swift`：本地热词、接口结果及缓存不再截取前 8 个，热门词布局不再限制两行。

## 全部国家／地区关键词

按地区代码排序。语言列表示词库来源语言，并非该地区唯一或官方语言。

| 代码 | 国家／地区 | 来源语言 | 数量 | 关键词（按顺序） |
| --- | --- | --- | ---: | --- |
| AC | 阿森松岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| AD | 安道尔 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| AE | 阿拉伯联合酋长国 | ar | 16 | 1. سجل الموقع<br>2. أليك<br>3. خانصاحب<br>4. أعمال الطرق<br>5. ترانسجارد<br>6. جولة تفقدية<br>7. بدء الدوام<br>8. خدمة<br>9. صيانة التكييف<br>10. إمريل<br>11. سجل التنظيف<br>12. دلسكو<br>13. أرامكس<br>14. استلام مواد<br>15. قراءة العداد<br>16. تسرب مياه |
| AF | 阿富汗 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| AG | 安提瓜和巴布达 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| AI | 安圭拉 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| AL | 阿尔巴尼亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| AM | 亚美尼亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| AO | 安哥拉 | pt-PT | 12 | 1. Serviços de veículos<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Segurança G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEN |
| AQ | 南极洲 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| AR | 阿根廷 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| AS | 美属萨摩亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| AT | 奥地利 | de | 12 | 1. Fahrzeugdienste<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Sicherheit<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| AU | 澳大利亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| AW | 阿鲁巴 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| AX | 奥兰群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| AZ | 阿塞拜疆 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BA | 波斯尼亚和黑塞哥维那 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BB | 巴巴多斯 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BD | 孟加拉国 | bn | 12 | 1. J&amp;T Express<br>2. G4S নিরাপত্তা<br>3. 7-ELEVEn<br>4. শেল<br>5. OPPO<br>6. নেসলে<br>7. কোকা-কোলা<br>8. Carrefour<br>9. আইকিয়া<br>10. PepsiCo<br>11. যানবাহন সেবা<br>12. KFC |
| BE | 比利时 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BF | 布基纳法索 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BG | 保加利亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BH | 巴林 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BI | 布隆迪 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BJ | 贝宁 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BL | 圣巴泰勒米 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BM | 百慕大 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BN | 文莱 | ms | 12 | 1. Perkhidmatan kenderaan<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Keselamatan G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BO | 玻利维亚 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BQ | 荷属加勒比区 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BR | 巴西 | pt | 14 | 1. Serviços de veículos<br>2. Claro<br>3. Mercado Libre<br>4. Vivo<br>5. J&amp;T Express<br>6. Segurança G4S<br>7. Padial<br>8. Emdur<br>9. Polícia<br>10. 7-ELEVEN<br>11. JSL<br>12. Médico<br>13. Fiberhome<br>14. Traxión |
| BS | 巴哈马 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BT | 不丹 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BV | 布韦岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BW | 博茨瓦纳 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BY | 白俄罗斯 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| BZ | 伯利兹 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CA | 加拿大 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CC | 科科斯（基林）群岛 | ms | 12 | 1. Perkhidmatan kenderaan<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Keselamatan G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CD | 刚果（金） | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CF | 中非共和国 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CG | 刚果（布） | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CH | 瑞士 | de | 12 | 1. Fahrzeugdienste<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Sicherheit<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CI | 科特迪瓦 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CK | 库克群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CL | 智利 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CM | 喀麦隆 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CN | 中国 | zh | 12 | 1. OPPO<br>2. 可口可乐<br>3. 车辆服务<br>4. 肯德基<br>5. 极兔速运<br>6. 壳牌<br>7. 百事可乐<br>8. 雀巢<br>9. 7-ELEVEn<br>10. 家乐福<br>11. 宜家<br>12. G4S Security |
| CO | 哥伦比亚 | es | 14 | 1. Claro<br>2. Servicios Vehicular<br>3. JSL<br>4. Seguridad G4S<br>5. Policía<br>6. DANE<br>7. CS1<br>8. Éxito<br>9. Fiberhome<br>10. Mercado Libre<br>11. Traxión<br>12. 7-ELEVEn<br>13. Vivo<br>14. J&amp;T Express |
| CP | 克利珀顿岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CQ | CQ | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CR | 哥斯达黎加 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CU | 古巴 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CV | 佛得角 | pt-PT | 12 | 1. Serviços de veículos<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Segurança G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEN |
| CW | 库拉索 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CX | 圣诞岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CY | 塞浦路斯 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| CZ | 捷克 | cs | 16 | 1. Stavební deník<br>2. Metrostav<br>3. EUROVIA<br>4. Práce na silnici<br>5. Začátek směny<br>6. M2C<br>7. Kontrolní obchůzka<br>8. OKIN Facility<br>9. Úklid<br>10. ČEZ<br>11. Odečet měřidla<br>12. Heimstaden<br>13. Kontrola domu<br>14. Dražice<br>15. Servisní zásah<br>16. Zásilkovna |
| DE | 德国 | de | 16 | 1. Bautagebuch<br>2. STRABAG<br>3. Straßenarbeiten<br>4. WISAG<br>5. Reinigungsrunde<br>6. KÖTTER<br>7. Kontrollgang<br>8. Telekom<br>9. Arbeitsbeginn<br>10. Vonovia<br>11. Wohnungsübergabe<br>12. Viessmann<br>13. Zählerstand<br>14. REMONDIS<br>15. Mängelbericht<br>16. DHL |
| DG | 迪戈加西亚岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| DJ | 吉布提 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| DK | 丹麦 | da | 16 | 1. Byggedagbog<br>2. Aarsleff<br>3. Colas<br>4. Vejarbejde<br>5. Mødetid<br>6. ISS<br>7. Rengøring<br>8. Securitas<br>9. Vagtrunde<br>10. DEAS<br>11. Ejendomstilsyn<br>12. Danfoss<br>13. Måleraflæsning<br>14. Norlys<br>15. Servicebesøg<br>16. PostNord |
| DM | 多米尼克 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| DO | 多米尼加共和国 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| DZ | 阿尔及利亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| EA | 休达及梅利利亚 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| EC | 厄瓜多尔 | es | 10 | 1. Dunkin'<br>2. Coca-Cola<br>3. Claro<br>4. J&amp;T Express<br>5. Seguridad G4S<br>6. Shell<br>7. Servicios Vehicular<br>8. KFC<br>9. PepsiCo<br>10. OPPO |
| EE | 爱沙尼亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| EG | 埃及 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| EH | 西撒哈拉 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| ER | 厄立特里亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| ES | 西班牙 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| ET | 埃塞俄比亚 | am | 12 | 1. PepsiCo<br>2. SPX እንቅስቃሴ<br>3. Nestlé<br>4. G4S ደህንነት<br>5. 7-ELEVEn<br>6. Shell<br>7. Carrefour<br>8. OPPO<br>9. የተሽከርካሪ አገልግሎቶች<br>10. IKEA<br>11. Coca-Cola<br>12. KFC |
| FI | 芬兰 | fi | 16 | 1. YIT<br>2. Työmaapäiväkirja<br>3. Työvuoron alku<br>4. Destia<br>5. Tien kunnossapito<br>6. Lumityöt<br>7. SOL<br>8. Siivous<br>9. Lumo<br>10. Kiinteistökierros<br>11. Securitas<br>12. Vartiointikierros<br>13. KONE<br>14. Huoltokäynti<br>15. Elisa<br>16. Posti |
| FJ | 斐济 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| FK | 福克兰群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| FM | 密克罗尼西亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| FO | 法罗群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| FR | 法国 | fr | 12 | 1. Nestlé<br>2. Coca-Cola<br>3. IKEA<br>4. Shell<br>5. J&amp;T Express<br>6. Carrefour<br>7. OPPO<br>8. Services de véhicules<br>9. KFC<br>10. 7-ELEVEn<br>11. PepsiCo<br>12. Sécurité G4S |
| GA | 加蓬 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GB | 英国 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GD | 格林纳达 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GE | 格鲁吉亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GF | 法属圭亚那 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GG | 根西岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GH | 加纳 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GI | 直布罗陀 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GL | 格陵兰 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GM | 冈比亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GN | 几内亚 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GP | 瓜德罗普 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GQ | 赤道几内亚 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GR | 希腊 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GS | 南乔治亚和南桑威奇群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GT | 危地马拉 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GU | 关岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| GW | 几内亚比绍 | pt-PT | 12 | 1. Serviços de veículos<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Segurança G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEN |
| GY | 圭亚那 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| HK | 中国香港特别行政区 | zh-Hant | 12 | 1. 车辆服务<br>2. 极兔速运<br>3. 可口可乐<br>4. 雀巢<br>5. G4S Security<br>6. 肯德基<br>7. 壳牌<br>8. 宜家<br>9. 家乐福<br>10. OPPO<br>11. 百事可乐<br>12. 7-ELEVEn |
| HM | 赫德岛和麦克唐纳群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| HN | 洪都拉斯 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| HR | 克罗地亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| HT | 海地 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| HU | 匈牙利 | hu | 16 | 1. Market<br>2. Építési napló<br>3. Műszakkezdés<br>4. B+N<br>5. Takarítás<br>6. Társasházi ellenőrzés<br>7. Valton<br>8. Őrjárat<br>9. Duna Group<br>10. Útkarbantartás<br>11. MVM<br>12. Mérőóra-leolvasás<br>13. HAJDU<br>14. Karbantartás<br>15. Telekom<br>16. MPL |
| IC | 加纳利群岛 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| ID | 印度尼西亚 | id | 20 | 1. Indomaret<br>2. SPX Express<br>3. Gaya Sederhana<br>4. OPPO<br>5. Aice<br>6. Indomie<br>7. HK &amp; JAYA<br>8. KAI<br>9. PLN<br>10. G4S Keamanan<br>11. KFC<br>12. Adhi<br>13. Wahana Express<br>14. Smartfren<br>15. TSS<br>16. J&amp;T Express<br>17. Khong Guan<br>18. QMB<br>19. Telkom Akses<br>20. Layanan |
| IE | 爱尔兰 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| IL | 以色列 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| IM | 马恩岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| IN | 印度 | hi | 16 | 1. निर्माण की प्रगति<br>2. L&amp;T<br>3. काम पर हाज़िरी<br>4. SIS<br>5. सुरक्षा गश्त<br>6. DLF<br>7. साइट की जाँच<br>8. BVG<br>9. सफाई का रिकॉर्ड<br>10. UltraTech<br>11. सड़क का काम<br>12. Jio<br>13. मीटर रीडिंग<br>14. Urban Company<br>15. उपकरण की जाँच<br>16. Delhivery |
| IO | 英属印度洋领地 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| IQ | 伊拉克 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| IR | 伊朗 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| IS | 冰岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| IT | 意大利 | it | 12 | 1. Sicurezza G4S<br>2. PepsiCo<br>3. Shell<br>4. IKEA<br>5. 7-ELEVEn<br>6. J&amp;T Express<br>7. Servizi per veicoli<br>8. Nestlé<br>9. KFC<br>10. Coca-Cola<br>11. OPPO<br>12. Carrefour |
| JE | 泽西岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| JM | 牙买加 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| JO | 约旦 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| JP | 日本 | ja | 14 | 1. 工事記録<br>2. ヤマト運輸<br>3. 設備点検<br>4. マキタ<br>5. 施工前<br>6. 佐川急便<br>7. 巡回記録<br>8. ダイキン<br>9. 材料搬入<br>10. LIXIL<br>11. 出勤記録<br>12. セコム<br>13. 施工後<br>14. 検針記録 |
| KE | 肯尼亚 | sw | 12 | 1. Huduma za gari<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Usalama wa G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| KG | 吉尔吉斯斯坦 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| KH | 柬埔寨 | km | 0 | 暂无关键词 |
| KI | 基里巴斯 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| KM | 科摩罗 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| KN | 圣基茨和尼维斯 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| KP | 朝鲜 | ko | 12 | 1. 차량 서비스<br>2. J&amp;T Express<br>3. 코카-콜라<br>4. 네슬레<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. 이케아<br>9. 카르푸<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| KR | 韩国 | ko | 16 | 1. 시공 기록<br>2. 현대건설<br>3. 에스원<br>4. 순찰 기록<br>5. 우리관리<br>6. 시설 점검<br>7. 미소<br>8. 청소 기록<br>9. 도로 작업<br>10. 출근<br>11. CJ대한통운<br>12. 자재 반입<br>13. 세스코<br>14. 한샘<br>15. 물품 인계<br>16. 하자 기록 |
| KW | 科威特 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| KY | 开曼群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| KZ | 哈萨克斯坦 | ru | 12 | 1. Услуги транспорта<br>2. J&amp;T Express<br>3. Кока-Кола<br>4. Нестле<br>5. Безопасность G4S<br>6. KFC<br>7. Шелл<br>8. ИКЕА<br>9. Карфур<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| LA | 老挝 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| LB | 黎巴嫩 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| LC | 圣卢西亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| LI | 列支敦士登 | de | 12 | 1. Fahrzeugdienste<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Sicherheit<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| LK | 斯里兰卡 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| LR | 利比里亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| LS | 莱索托 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| LT | 立陶宛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| LU | 卢森堡 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| LV | 拉脱维亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| LY | 利比亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MA | 摩洛哥 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MC | 摩纳哥 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MD | 摩尔多瓦 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| ME | 黑山 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MF | 法属圣马丁 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MG | 马达加斯加 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MH | 马绍尔群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MK | 北马其顿 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| ML | 马里 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MM | 缅甸 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MN | 蒙古 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MO | 中国澳门特别行政区 | zh-Hant | 12 | 1. 车辆服务<br>2. 极兔速运<br>3. 可口可乐<br>4. 雀巢<br>5. G4S Security<br>6. 肯德基<br>7. 壳牌<br>8. 宜家<br>9. 家乐福<br>10. OPPO<br>11. 百事可乐<br>12. 7-ELEVEn |
| MP | 北马里亚纳群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MQ | 马提尼克 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MR | 毛里塔尼亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MS | 蒙特塞拉特 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MT | 马耳他 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MU | 毛里求斯 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MV | 马尔代夫 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MW | 马拉维 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| MX | 墨西哥 | es | 12 | 1. Policía<br>2. OPPO<br>3. Vivo<br>4. Servicios Vehicular<br>5. J&amp;T Express<br>6. Mercado Libre<br>7. 7-ELEVEn<br>8. JSL<br>9. Traxión<br>10. Claro<br>11. Fiberhome<br>12. Seguridad G4S |
| MY | 马来西亚 | ms | 16 | 1. SPX Express<br>2. Keselamatan G4S<br>3. Flash Ekspres<br>4. Pembinaan Negara China<br>5. PepsiCo<br>6. Guardian<br>7. J&amp;T Express<br>8. OPPO<br>9. KFC<br>10. Unifi<br>11. UTC<br>12. Amano<br>13. Bataras<br>14. 7-ELEVEn<br>15. Perkhidmatan kenderaan<br>16. Metro |
| MZ | 莫桑比克 | pt-PT | 12 | 1. Serviços de veículos<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Segurança G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEN |
| NA | 纳米比亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| NC | 新喀里多尼亚 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| NE | 尼日尔 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| NF | 诺福克岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| NG | 尼日利亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| NI | 尼加拉瓜 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| NL | 荷兰 | nl | 16 | 1. PostNL<br>2. Bouwverslag<br>3. BAM<br>4. Inklokken<br>5. Trigion<br>6. Bewakingsronde<br>7. CSU<br>8. Schoonmaakronde<br>9. MVGM<br>10. Schadeopname<br>11. Heijmans<br>12. Wegwerkzaamheden<br>13. Unica<br>14. Onderhoud<br>15. Renewi<br>16. Meterstand |
| NO | 挪威 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| NP | 尼泊尔 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| NR | 瑙鲁 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| NU | 纽埃 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| NZ | 新西兰 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| OM | 阿曼 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| PA | 巴拿马 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| PE | 秘鲁 | es | 13 | 1. Claro<br>2. Oficina de Conservación del Agua<br>3. Hyundai<br>4. Seguridad G4S<br>5. Servicios Vehicular<br>6. Coca-Cola<br>7. J&amp;T Express<br>8. Shell<br>9. Gobernanza Colaborativa<br>10. Dunkin'<br>11. Grupo Flesan<br>12. 7-ELEVEn<br>13. IKEA |
| PF | 法属波利尼西亚 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| PG | 巴布亚新几内亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| PH | 菲律宾 | fil | 13 | 1. Shell<br>2. Aice<br>3. PLDT<br>4. SPX Express<br>5. Lotto Outlet<br>6. 7-ELEVEn<br>7. KFC<br>8. Mercury Drug<br>9. Flash Express<br>10. G4S Security<br>11. K5 News<br>12. PTPP<br>13. Skyro |
| PK | 巴基斯坦 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| PL | 波兰 | pl | 16 | 1. Prace remontowe<br>2. Budimex<br>3. InPost<br>4. Początek pracy<br>5. STRABAG<br>6. Roboty drogowe<br>7. Solid Security<br>8. Obchód obiektu<br>9. Impel<br>10. Sprzątanie<br>11. CBRE<br>12. Usterki<br>13. Veolia<br>14. Serwis ogrzewania<br>15. REMONDIS<br>16. Odczyt licznika |
| PM | 圣皮埃尔和密克隆群岛 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| PN | 皮特凯恩群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| PR | 波多黎各 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| PS | 巴勒斯坦领土 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| PT | 葡萄牙 | pt-PT | 12 | 1. Serviços de veículos<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Segurança G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEN |
| PW | 帕劳 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| PY | 巴拉圭 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| QA | 卡塔尔 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| RE | 留尼汪 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| RO | 罗马尼亚 | ro | 16 | 1. CONA<br>2. Jurnal de șantier<br>3. Dedeman<br>4. Primire materiale<br>5. Început de tură<br>6. STRABAG<br>7. Lucrări la drum<br>8. Romprest<br>9. Curățenie<br>10. Verificare clădire<br>11. BGS<br>12. Rond de pază<br>13. DIGI<br>14. Intervenție tehnică<br>15. Electrica Furnizare<br>16. FAN Courier |
| RS | 塞尔维亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| RU | 俄罗斯 | ru | 12 | 1. Безопасность G4S<br>2. Кока-Кола<br>3. Карфур<br>4. PepsiCo<br>5. Шелл<br>6. KFC<br>7. Нестле<br>8. OPPO<br>9. 7-ELEVEn<br>10. Услуги транспорта<br>11. J&amp;T Express<br>12. ИКЕА |
| RW | 卢旺达 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SA | 沙特阿拉伯 | ar | 0 | 暂无关键词 |
| SB | 所罗门群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SC | 塞舌尔 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SD | 苏丹 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SE | 瑞典 | sv | 16 | 1. Fastighetsrond<br>2. HSB<br>3. Byggarbete<br>4. Skanska<br>5. Stämpla in<br>6. Securitas<br>7. Bevakningsrond<br>8. Samhall<br>9. Städning<br>10. Svevia<br>11. Snöröjning<br>12. Bravida<br>13. Värmepump<br>14. Ragn-Sells<br>15. PostNord<br>16. Skadedokumentation |
| SG | 新加坡 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SH | 圣赫勒拿 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SI | 斯洛文尼亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SJ | 斯瓦尔巴和扬马延 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SK | 斯洛伐克 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SL | 塞拉利昂 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SM | 圣马力诺 | it | 12 | 1. Servizi per veicoli<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sicurezza G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SN | 塞内加尔 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SO | 索马里 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SR | 苏里南 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SS | 南苏丹 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| ST | 圣多美和普林西比 | pt-PT | 12 | 1. Serviços de veículos<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Segurança G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEN |
| SV | 萨尔瓦多 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SX | 荷属圣马丁 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SY | 叙利亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| SZ | 斯威士兰 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| TA | 特里斯坦-达库尼亚群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| TC | 特克斯和凯科斯群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| TD | 乍得 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| TF | 法属南部领地 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| TG | 多哥 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| TH | 泰国 | th | 18 | 1. ไทยวัสดุ<br>2. สถาปัตยกรรมจีน<br>3. มินิมอล<br>4. J&amp;T Express<br>5. Lay's<br>6. แฟลช เอ็กซ์เพรส<br>7. บริการรถยนต์<br>8. Big C<br>9. STIT<br>10. G4S Security<br>11. SCG<br>12. SSC<br>13. Unilever<br>14. AIS<br>15. 7-ELEVEn<br>16. รัฐบาลเมืองตรัง<br>17. LINE MAN<br>18. ทัสค์ อินทีเรีย |
| TJ | 塔吉克斯坦 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| TK | 托克劳 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| TL | 东帝汶 | pt-PT | 12 | 1. Serviços de veículos<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Segurança G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEN |
| TM | 土库曼斯坦 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| TN | 突尼斯 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| TO | 汤加 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| TR | 土耳其 | tr | 12 | 1. Coca-Cola<br>2. Nestlé<br>3. Shell<br>4. KFC<br>5. 7-ELEVEn<br>6. Carrefour<br>7. PepsiCo<br>8. IKEA<br>9. Araç hizmetleri<br>10. G4S Güvenlik<br>11. J&amp;T Express<br>12. OPPO |
| TT | 特立尼达和多巴哥 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| TV | 图瓦卢 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| TW | 台湾 | zh-Hant | 0 | 暂无关键词 |
| TZ | 坦桑尼亚 | sw | 12 | 1. J&amp;T Express<br>2. IKEA<br>3. 7-ELEVEn<br>4. Usalama wa G4S<br>5. Carrefour<br>6. Shell<br>7. PepsiCo<br>8. Coca-Cola<br>9. Nestlé<br>10. Huduma za gari<br>11. KFC<br>12. OPPO |
| UA | 乌克兰 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| UG | 乌干达 | sw | 12 | 1. Huduma za gari<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Usalama wa G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| UM | 美国本土外小岛屿 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| US | 美国 | en | 19 | 1. Standard Waste<br>2. AT&amp;T<br>3. Favor<br>4. Belfor<br>5. Uber<br>6. Apex<br>7. eZee<br>8. Inspection of permit<br>9. SG<br>10. Colonial Pipeline<br>11. Instacart<br>12. Walmart<br>13. 7-ELEVEn<br>14. VAST<br>15. Construction RFI<br>16. General Electric<br>17. Davey<br>18. Sletten<br>19. Texas Counties |
| UY | 乌拉圭 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| UZ | 乌兹别克斯坦 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| VA | 梵蒂冈 | it | 12 | 1. Servizi per veicoli<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sicurezza G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| VC | 圣文森特和格林纳丁斯 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| VE | 委内瑞拉 | es | 12 | 1. Servicios Vehicular<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Seguridad G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| VG | 英属维尔京群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| VI | 美属维尔京群岛 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| VN | 越南 | vi | 19 | 1. QMB<br>2. VFC<br>3. Lotte Mart<br>4. WinMart<br>5. OPPO<br>6. PepsiCo<br>7. Securitas<br>8. FPT Corporation<br>9. Tập đoàn Deoca<br>10. Unilever<br>11. Tập đoàn HopLuc<br>12. Viettel<br>13. SPX Express<br>14. J&amp;T Express<br>15. APG<br>16. Vingroup<br>17. Dịch vụ xe cộ<br>18. CSGT<br>19. Zalo |
| VU | 瓦努阿图 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| WF | 瓦利斯和富图纳 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| WS | 萨摩亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| XK | 科索沃 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| YE | 也门 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| YT | 马约特 | fr | 12 | 1. Services de véhicules<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. Sécurité G4S<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| ZA | 南非 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| ZM | 赞比亚 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |
| ZW | 津巴布韦 | en | 12 | 1. Vehicle services<br>2. J&amp;T Express<br>3. Coca-Cola<br>4. Nestlé<br>5. G4S Security<br>6. KFC<br>7. Shell<br>8. IKEA<br>9. Carrefour<br>10. OPPO<br>11. PepsiCo<br>12. 7-ELEVEn |

## 空白地区

- 柬埔寨（KH）：源目录没有品牌词，未填入虚构关键词，可在后台补充。
- 沙特阿拉伯（SA）：源目录没有品牌词，未填入虚构关键词，可在后台补充。
- 台湾（TW）：源目录没有品牌词，未填入虚构关键词，可在后台补充。

## 数据溯源

每个地区的具体源文件路径见 `src/lib/templates/trending-regions.json` 中的 `source` 字段；路径相对于 `gps_map_camera` 项目根目录。
