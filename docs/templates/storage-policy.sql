-- Supabase Storage ONLY. Sharing records are in MySQL, not PostgreSQL.
-- Review existing storage policies before running in the Supabase SQL console.
-- A private bucket alone does not neutralize permissive authenticated policies.
CREATE POLICY timeprint_template_bucket_isolation ON storage.objects
 AS RESTRICTIVE FOR ALL TO anon, authenticated
 USING (bucket_id <> 'template-assets-v2')
 WITH CHECK (bucket_id <> 'template-assets-v2');
-- Change the literal if TEMPLATE_ASSETS_BUCKET differs. service_role remains
-- server-only and bypasses RLS. No direct anon/authenticated policy is added.
