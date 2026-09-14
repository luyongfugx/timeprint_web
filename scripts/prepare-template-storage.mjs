import { createClient } from "@supabase/supabase-js";
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("Configure the existing Supabase project's server-only storage key first.");
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = process.env.TEMPLATE_ASSETS_BUCKET ?? "template-assets-v2";
const { data, error } = await client.storage.getBucket(bucket);
if (data) {
  if (data.public)
    throw new Error("The template bucket is public; keep publication disabled and review access policies.");
  console.log("Private bucket exists. Separately verify anonymous/authenticated storage access is denied.");
} else if (process.argv.includes("--apply")) {
  if (error && !["404", "400"].includes(String(error.status))) throw new Error("Could not inspect storage bucket.");
  const result = await client.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 10485760,
    allowedMimeTypes: ["application/json", "image/png", "image/jpeg", "image/webp"],
  });
  if (result.error) throw new Error("Could not create private template bucket.");
  console.log("Created private bucket. Audit Storage policies before enabling publication.");
} else console.log("Bucket not available. After reviewing storage access, rerun with --apply to create it.");
