"use client";
import { useState, type FormEvent } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserStore } from "@/stores/users/userStore";

export function LoginForm() {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(response.status === 429 ? "尝试次数过多，请稍后再试" : (data.error?.message ?? "登录失败，请重试"));
        return;
      }
      setUser(data.user);
      router.replace("/dashboard/watermark");
      router.refresh();
    } catch {
      setError("连接失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          邮箱
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          placeholder="请输入管理员邮箱"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          密码
        </label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Button className="w-full" type="submit" disabled={busy}>
        {busy ? "正在登录…" : "登录"}
      </Button>
    </form>
  );
}
