// Snapshot the actual iOS localization directories; builds never require the iOS checkout.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve(process.argv[2] ?? "../gps_map_camera");
const directory = join(root, "iOSTimeGPS/Resource/Language");
const target = resolve("src/lib/templates/client-locales.json");
const codes = readdirSync(directory, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name.endsWith(".lproj") && e.name !== "Base.lproj")
  .map((e) => e.name.slice(0, -6))
  .sort();
const existing = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")).languages : [];
const prior = new Map(existing.map((item) => [item.code, item]));
const chinese = new Intl.DisplayNames(["zh-Hans"], { type: "language" });
const african = new Set("af ak am arz ha ig mg ny om rw sn so st sw ti xh yo zu zu-ZA".split(" "));
const european = new Set(
  "be bg bs ca cs cy da de el en es es-ES et eu fi fr ga gd gl hr hu is it lb lt lv mk mt nb nl nn pl pl-PL pt pt-PT ro ru sk sl sq sr sv sv-SE uk yi".split(
    " ",
  ),
);
const american = new Set(["ht", "mi"]);
const languages = codes.map((code) => ({
  code,
  name: prior.get(code)?.name ?? new Intl.DisplayNames([code], { type: "language" }).of(code),
  search: chinese.of(code),
  group: african.has(code) ? "非洲" : european.has(code) ? "欧洲" : american.has(code) ? "美洲与大洋洲" : "亚洲",
}));
writeFileSync(
  target,
  JSON.stringify({ source: "gps_map_camera/iOSTimeGPS/Resource/Language/*.lproj", languages }, null, 2) + "\n",
);
console.log(`Synced ${codes.length} client locales`);
