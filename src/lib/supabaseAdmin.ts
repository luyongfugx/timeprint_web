import "server-only";
import { createClient } from "@supabase/supabase-js";

import { unavailable } from "./templates/errors";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) unavailable();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15_000), cache: "no-store" }),
    },
  });
}
