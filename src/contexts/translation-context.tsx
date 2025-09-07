"use client"

import { createContext, useContext, type ReactNode } from "react"

type Messages = Record<string, any> // Loosely typed for simplicity

interface TranslationContextType {
  messages: Messages
  locale: string
  t: (key: string, params?: Record<string, string | number>) => string
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined)

export function TranslationProvider({
  children,
  messages,
  locale,
}: {
  children: ReactNode
  messages: Messages
  locale: string
}) {
  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split(".")
    let value: any = messages
    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k]
      } else {
        return key // Return key if not found
      }
    }

    if (typeof value === "string") {
      let translated = value
      if (params) {
        for (const paramKey in params) {
          translated = translated.replace(`{${paramKey}}`, String(params[paramKey]))
        }
      }
      return translated
    }
    return key // Return key if not a string
  }

  return <TranslationContext.Provider value={{ messages, locale, t }}>{children}</TranslationContext.Provider>
}

export function useTranslation() {
  const context = useContext(TranslationContext)
  if (context === undefined) {
    throw new Error("useTranslation must be used within a TranslationProvider")
  }
  return context
}
