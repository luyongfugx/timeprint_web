"use client"
import { siGoogle } from "simple-icons";

import { SimpleIcon } from "@/components/simple-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
// import { useTranslation } from "@/contexts/translation-context"
import { useState } from "react";
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
export function GoogleButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  // const { t, locale } = useTranslation()
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const handleGoogleSignIn = async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/api/auth/callback", // 回调地址
      },
    });

    if (error) {
      toast({
        title: "loginPage.googleSignInFailed",
        description: error.message,
        variant: "destructive",
      })
    } else {
      toast({
        title: "loginPage.signInSuccess",
        description:"loginPage.signInSuccessDescription",
      })
      router.push(`/dashboard/default`)
      router.refresh()
    }
    setLoading(false)
  };

  return (
    <Button variant="secondary" className={cn(className)} {...props} onClick={handleGoogleSignIn} disabled={loading}>
      <SimpleIcon icon={siGoogle} className="size-4" />
      Continue with Google
    </Button>
  );
}
