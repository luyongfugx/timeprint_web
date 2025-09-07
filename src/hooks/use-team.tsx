"use client"

import { create } from "zustand"
import { useAuthStore } from "./use-auth"
import { useEffect } from "react"

interface Team {
  id: string
  name: string
  address: string | null
  description: string | null
  user_id: string
}

interface TeamStore {
  team: Team | null
  userRole: string | null
  loading: boolean
  setTeam: (team: Team | null) => void
  setUserRole: (role: string | null) => void
  setLoading: (loading: boolean) => void
  refreshTeam: () => Promise<void>
}

const useTeamStore = create<TeamStore>((set, get) => ({
  team: null,
  userRole: null,
  loading: true,

  setTeam: (team) => set({ team }),
  setUserRole: (userRole) => set({ userRole }),
  setLoading: (loading) => set({ loading }),

  refreshTeam: async () => {
    const user = useAuthStore.getState().user

    if (!user) {
      set({ team: null, userRole: null, loading: false })
      return
    }

    try {
      const response = await fetch("/api/teams/membership")
      const data = await response.json()

      if (!response.ok) {
        console.error("Error fetching team:", data.error)
        set({ team: null, userRole: null })
      } else if (data.teamMember && data.teamMember.teams) {
        set({
          team: data.teamMember.teams as Team,
          userRole: data.teamMember.role,
        })
      } else {
        set({ team: null, userRole: null })
      }
    } catch (error) {
      console.error("Error in refreshTeam:", error)
      set({ team: null, userRole: null })
    } finally {
      set({ loading: false })
    }
  },
}))

export function useTeam() {
  const store = useTeamStore()
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    store.refreshTeam()
  }, [user, store.refreshTeam])

  return {
    team: store.team,
    userRole: store.userRole,
    loading: store.loading,
    refreshTeam: store.refreshTeam,
  }
}

// Export the store for direct access if needed
export { useTeamStore }
