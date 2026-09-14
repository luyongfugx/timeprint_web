"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { getInitials } from "@/lib/utils";
import { useUserStore } from "@/stores/users/userStore";

export function NavUser() {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const clearUser = useUserStore((state) => state.clearUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const result = await fetch("/api/auth/logout", { method: "POST" });
      if (!result.ok) throw new Error("退出失败，请重试");
      clearUser();
      router.replace("/auth/v1/login");
      router.refresh();
    } catch {
      setError("退出失败，请重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center gap-2 p-2">
          <Avatar className="size-8 rounded-lg">
            <AvatarFallback>{getInitials(user?.email ?? "")}</AvatarFallback>
          </Avatar>
          <span className="truncate text-sm group-data-[collapsible=icon]:hidden">{user?.email}</span>
        </div>
        <SidebarMenuButton onClick={logout} disabled={busy} tooltip="退出登录">
          <LogOut />
          <span>{busy ? "正在退出…" : "退出登录"}</span>
        </SidebarMenuButton>
        {error && (
          <p role="alert" className="p-2 text-xs text-red-600">
            {error}
          </p>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
