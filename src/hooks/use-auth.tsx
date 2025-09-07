"use client"

import { useEffect } from "react"
import { create } from "zustand"
import type { User } from "@supabase/supabase-js"

interface AuthStore {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => Promise<void>
  checkSession: () => Promise<void>
  startSessionPolling: () => void
  stopSessionPolling: () => void
}

const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: true,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),

  signOut: async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      })

      if (response.ok) {
        set({ user: null })
      }
    } catch (error) {
      console.error("Error signing out:", error)
    }
  },

  checkSession: async () => {
    try {
      const response = await fetch("/api/auth/session")
      const data = await response.json()

      if (response.ok) {
        set({ user: data.user })
      }
    } catch (error) {
      console.error("Error checking session:", error)
    } finally {
      set({ loading: false })
    }
  },

  startSessionPolling: () => {
    const { checkSession } = get()

    // Initial session check
    checkSession()

    // Set up polling interval
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/auth/session")
        const data = await response.json()

        if (response.ok) {
          set({ user: data.user })
        }
      } catch (error) {
        console.error("Error checking session:", error)
      }
    }, 30000) // Check every 30 seconds

    // Store interval ID for cleanup
    ;(globalThis as any).__authInterval = interval
  },

  stopSessionPolling: () => {
    if ((globalThis as any).__authInterval) {
      clearInterval((globalThis as any).__authInterval)
      delete (globalThis as any).__authInterval
    }
  },
}))

export function useAuth() {
  const store = useAuthStore()

  // Initialize session polling on first use
  useEffect(() => {
    store.startSessionPolling()

    return () => {
      store.stopSessionPolling()
    }
  }, [])

  return {
    user: store.user,
    loading: store.loading,
    signOut: store.signOut,
  }
}

// Export the store for direct access if needed
export { useAuthStore }
