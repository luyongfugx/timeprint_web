

const dictionaries = {
  en: () => import("../messages/en.json").then((module) => module.default),
  zh: () => import("../messages/zh.json").then((module) => module.default),
}

export type Locale = keyof typeof dictionaries

export const getMessages = async (locale: Locale) => dictionaries[locale]()
