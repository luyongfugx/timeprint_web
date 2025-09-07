// providers/UserProvider.tsx
'use client'

import { ReactNode, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUserStore } from './userStore'

export function UserProvider({ children }: { children: ReactNode }) {
  const setUser = useUserStore((state) => state.setUser)
  const clearUser = useUserStore((state) => state.clearUser)

  useEffect(() => {
    // 获取当前 session
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user)
      } else {
        clearUser()
      }
    })

    // 监听登录/登出事件
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
      } else {
        clearUser()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [setUser, clearUser])

  return children
}
