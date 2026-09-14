import { redirect } from "next/navigation";

import { currentUser } from "@/lib/auth/session";

import { LoginForm } from "../../_components/login-form";

export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard/watermark");
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Timeprint 管理后台</h1>
          <p className="text-muted-foreground text-sm">使用管理员邮箱和密码登录</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
