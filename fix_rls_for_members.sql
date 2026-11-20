-- ==============================================================================
-- 🚀 FIX UNTUK SUPABASE RLS (ROW LEVEL SECURITY) AGAR TEAM MEMBER BISA AKSES
-- ==============================================================================
-- Masalah "tidak sinkron" karena tim member diblokir oleh Supabase RLS.
-- Jalankan kode SQL ini di menu "SQL Editor" pada dashboard Supabase Anda.

-- 1. POSTS TABLE
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."posts";
DROP POLICY IF EXISTS "Allow members to read posts" ON "public"."posts";
DROP POLICY IF EXISTS "Allow members to insert posts" ON "public"."posts";
DROP POLICY IF EXISTS "Allow members to update posts" ON "public"."posts";

CREATE POLICY "Allow members to read posts" ON "public"."posts"
FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "Allow members to insert posts" ON "public"."posts"
FOR INSERT WITH CHECK (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "Allow members to update posts" ON "public"."posts"
FOR UPDATE USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

-- 2. RAW IDEAS TABLE (IDEA BANK)
DROP POLICY IF EXISTS "Allow members to read raw ideas" ON "public"."raw_ideas";
DROP POLICY IF EXISTS "Allow members to insert raw ideas" ON "public"."raw_ideas";
DROP POLICY IF EXISTS "Allow members to update raw ideas" ON "public"."raw_ideas";
DROP POLICY IF EXISTS "Allow members to delete raw ideas" ON "public"."raw_ideas";

CREATE POLICY "Allow members to read raw ideas" ON "public"."raw_ideas"
FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "Allow members to insert raw ideas" ON "public"."raw_ideas"
FOR INSERT WITH CHECK (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "Allow members to update raw ideas" ON "public"."raw_ideas"
FOR UPDATE USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "Allow members to delete raw ideas" ON "public"."raw_ideas"
FOR DELETE USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

-- 3. WORKSPACE TAGS (Pillar, Funnel, Statuses, Content Types)
-- (Disembunyikan karena tabel belum ada di environment ini)
-- DROP POLICY IF EXISTS "Allow members to read tags" ON "public"."workspace_tags";

-- CREATE POLICY "Allow members to read tags" ON "public"."workspace_tags"
-- FOR SELECT USING (
--   workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
-- );
