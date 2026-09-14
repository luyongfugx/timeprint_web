"use client";
import { type ReactNode, useEffect } from "react";

import { useUserStore } from "./userStore";

export function UserProvider({ children }: { children: ReactNode }) {
  const setUser = useUserStore((s) => s.setUser);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { user: null }))
      .then((data) => setUser(data.user))
      .catch(() => {});
    return () => controller.abort();
  }, [setUser]);
  return children;
}
