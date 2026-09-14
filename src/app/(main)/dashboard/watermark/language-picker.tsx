"use client";

import { useState } from "react";

import { Check, ChevronDown, Globe, Search } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const groups: { name: string; languages: [string, string, string][] }[] = [
  {
    name: "亚洲",
    languages: [
      ["zh-CN", "中文（简体）", "简体中文 中国"],
      ["zh-Hans", "中文（简体字）", "简体中文"],
      ["zh-TW", "繁體中文（台灣）", "繁体中文 台湾"],
      ["zh-HK", "繁體中文（香港）", "繁体中文 香港"],
      ["zh-Hant", "繁體中文（繁體字）", "繁体中文"],
      ["hi", "हिन्दी", "印地语 Hindi"],
      ["bn", "বাংলা", "孟加拉语 Bengali"],
      ["ar", "العربية", "阿拉伯语 Arabic"],
      ["id", "Bahasa Indonesia", "印度尼西亚语 Indonesian"],
      ["ur", "اردو", "乌尔都语 Urdu"],
      ["ja", "日本語", "日语 Japanese"],
      ["pa", "ਪੰਜਾਬੀ", "旁遮普语 Punjabi"],
      ["jv", "Basa Jawa", "爪哇语 Javanese"],
      ["vi", "Tiếng Việt", "越南语 Vietnamese"],
      ["te", "తెలుగు", "泰卢固语 Telugu"],
      ["tr", "Türkçe", "土耳其语 Turkish"],
      ["ko", "한국어", "韩语 Korean"],
      ["ta", "தமிழ்", "泰米尔语 Tamil"],
      ["mr", "मराठी", "马拉地语 Marathi"],
      ["fa", "فارسی", "波斯语 Persian"],
      ["gu", "ગુજરાતી", "古吉拉特语 Gujarati"],
      ["kn", "ಕನ್ನಡ", "卡纳达语 Kannada"],
      ["ml", "മലയാളം", "马拉雅拉姆语 Malayalam"],
      ["or", "ଓଡ଼ିଆ", "奥里亚语 Odia"],
      ["my", "မြန်မာ", "缅甸语 Burmese"],
      ["th", "ไทย", "泰语 Thai"],
      ["uz", "O‘zbekcha", "乌兹别克语 Uzbek"],
      ["az", "Azərbaycan", "阿塞拜疆语 Azerbaijani"],
      ["si", "සිංහල", "僧伽罗语 Sinhala"],
      ["ne", "नेपाली", "尼泊尔语 Nepali"],
      ["he", "עברית", "希伯来语 Hebrew"],
      ["km", "ខ្មែរ", "高棉语 Khmer"],
      ["tg", "Тоҷикӣ", "塔吉克语 Tajik"],
      ["kk", "Қазақ", "哈萨克语 Kazakh"],
      ["hy", "Հայերեն", "亚美尼亚语 Armenian"],
      ["lo", "ລາວ", "老挝语 Lao"],
      ["ku", "Kurdî", "库尔德语 Kurdish"],
      ["as", "অসমীয়া", "阿萨姆语 Assamese"],
      ["ms", "Bahasa Melayu", "马来语 Malay"],
      ["fil", "Filipino", "菲律宾语"],
      ["ceb", "Cebuano", "宿务语"],
      ["ps", "پښتو", "普什图语 Pashto"],
      ["tk", "Türkmençe", "土库曼语 Turkmen"],
      ["ky", "Кыргызча", "吉尔吉斯语 Kyrgyz"],
      ["mn", "Монгол", "蒙古语 Mongolian"],
      ["dv", "ދިވެހި", "迪维希语 Dhivehi"],
      ["ka", "ქართული", "格鲁吉亚语 Georgian"],
    ],
  },
  {
    name: "欧洲",
    languages: [
      ["en", "English", "英语"],
      ["ru", "Русский", "俄语 Russian"],
      ["de", "Deutsch", "德语 German"],
      ["fr", "Français", "法语 French"],
      ["it", "Italiano", "意大利语 Italian"],
      ["es", "Español", "西班牙语 Spanish"],
      ["uk", "Українська", "乌克兰语 Ukrainian"],
      ["pl", "Polski", "波兰语 Polish"],
      ["pt", "Português", "葡萄牙语 Portuguese"],
      ["nl", "Nederlands", "荷兰语 Dutch"],
      ["sv", "Svenska", "瑞典语 Swedish"],
      ["no", "Norsk", "挪威语 Norwegian"],
      ["da", "Dansk", "丹麦语 Danish"],
      ["fi", "Suomi", "芬兰语 Finnish"],
      ["el", "Ελληνικά", "希腊语 Greek"],
      ["cs", "Čeština", "捷克语 Czech"],
      ["ro", "Română", "罗马尼亚语 Romanian"],
      ["hu", "Magyar", "匈牙利语 Hungarian"],
    ],
  },
  {
    name: "美洲与大洋洲",
    languages: [
      ["en-US", "English (US)", "美国英语"],
      ["en-AU", "English (Australia)", "澳大利亚英语"],
      ["es-MX", "Español (México)", "墨西哥西班牙语"],
      ["pt-BR", "Português (Brasil)", "巴西葡萄牙语"],
      ["fr-CA", "Français (Canada)", "加拿大法语"],
      ["mi", "Māori", "毛利语"],
    ],
  },
  {
    name: "非洲",
    languages: [
      ["sw", "Kiswahili", "斯瓦希里语 Swahili"],
      ["af", "Afrikaans", "南非荷兰语"],
      ["am", "አማርኛ", "阿姆哈拉语 Amharic"],
      ["ha", "Hausa", "豪萨语"],
      ["yo", "Yorùbá", "约鲁巴语"],
      ["zu", "isiZulu", "祖鲁语 Zulu"],
    ],
  },
];

export function LanguagePicker({ value, onChange }: { value: string; onChange: (locale: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const all = groups.flatMap((group) => group.languages);
  const selected = all.find(([code]) => code === value);
  const search = query.trim().toLowerCase();
  const filtered = groups
    .map((group) => ({
      ...group,
      languages: group.languages.filter((language) =>
        `${group.name} ${language.join(" ")}`.toLowerCase().includes(search),
      ),
    }))
    .filter((group) => group.languages.length);
  const custom = /^[a-zA-Z0-9-]{2,35}$/.test(query.trim()) && !all.some(([code]) => code.toLowerCase() === search);
  function select(code: string) {
    onChange(code);
    setOpen(false);
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="bg-background hover:bg-accent inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-sm"
          aria-label={`选择语言：${selected?.[1] ?? value}`}
        >
          <Globe className="size-4" aria-hidden="true" />
          {selected?.[1] ?? value}
          <span className="text-muted-foreground text-xs">{value}</span>
          <ChevronDown className="text-muted-foreground size-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        collisionPadding={16}
        className="flex max-h-[min(75vh,var(--radix-popover-content-available-height))] w-[min(1100px,calc(100vw-2rem))] flex-col gap-4 overflow-hidden rounded-2xl border p-4 shadow-xl"
        aria-label="选择热门搜索词语言"
      >
        <div className="relative shrink-0">
          <Search className="text-muted-foreground absolute top-3 left-3 size-5" aria-hidden="true" />
          <input
            aria-label="搜索语言"
            placeholder="搜索语言、中文名称或语言代码"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-background focus-visible:ring-ring h-11 w-full rounded-xl border pr-3 pl-10 text-sm outline-none focus-visible:ring-2"
          />
        </div>
        <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
          {filtered.map((group) => (
            <section key={group.name} aria-label={group.name}>
              <h3 className="mb-2 rounded-lg border-l-4 border-orange-500 bg-orange-50 px-4 py-2.5 font-semibold text-orange-950 dark:bg-orange-950/30 dark:text-orange-100">
                {group.name}
              </h3>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
                {group.languages.map(([code, name]) => (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={value === code}
                    title={`${name} (${code})`}
                    onClick={() => select(code)}
                    className={`hover:bg-accent focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-lg px-3 py-3 text-left text-sm focus-visible:ring-2 focus-visible:outline-none ${value === code ? "bg-accent font-semibold" : ""}`}
                  >
                    <span className="min-w-0 flex-1 truncate" dir="auto">
                      {name}
                    </span>
                    {value === code && <Check className="size-4 shrink-0 text-orange-600" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {!filtered.length && <p className="text-muted-foreground py-4 text-center text-sm">未找到匹配的语言</p>}
          {custom && (
            <button
              type="button"
              className="hover:bg-accent w-full rounded-lg border px-3 py-3 text-left text-sm"
              onClick={() => select(query.trim())}
            >
              使用语言代码：{query.trim()}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
