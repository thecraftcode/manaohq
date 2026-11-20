-- =====================================================================
-- ManaoHQ — Full Database Rebuild Script (COMPLETE + FIXED)
-- =====================================================================
-- STRUKTUR:
--   A. Extensions
--   B. Tables (9 tabel)
--   C. Enable RLS
--   D. Helper Functions (SECURITY DEFINER — anti-recursion)
--   E. RLS Policies (menggunakan helper function)
--   F. Trigger Functions + Triggers
--   G. Indexes
--   H. Publications (Realtime)
--   I. Storage + Policies
--   J. Grants
-- =====================================================================


-- ═══════════════════════════════════════════════════════════════════════
-- A. EXTENSIONS
-- ═══════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"      WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"       WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm"        WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgjwt"          WITH SCHEMA extensions;


-- ═══════════════════════════════════════════════════════════════════════
-- B. ALL TABLES
-- ═══════════════════════════════════════════════════════════════════════

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. WORKSPACES
CREATE TABLE IF NOT EXISTS public.workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. WORKSPACE_MEMBERS
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'member',
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- 4. TEAM_MEMBERS
CREATE TABLE IF NOT EXISTS public.team_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT DEFAULT 'Member',
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id  UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 5. WORKSPACE_TAGS
CREATE TABLE IF NOT EXISTS public.workspace_tags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  name          TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT '#6366f1',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 6. POSTS
CREATE TABLE IF NOT EXISTS public.posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  idea            TEXT DEFAULT '',
  pillar          TEXT DEFAULT '',
  funnel          TEXT DEFAULT '',
  type            TEXT DEFAULT '',
  status          TEXT DEFAULT 'Draft',
  pic             TEXT DEFAULT '',
  deadline        DATE,
  post_date       DATE,
  asset_link      TEXT DEFAULT '',
  published_link  TEXT DEFAULT '',
  script          TEXT DEFAULT '',
  brief           TEXT,
  hook            TEXT DEFAULT '',
  caption         TEXT DEFAULT '',
  ig_link         TEXT DEFAULT '',
  gdrive_link     TEXT DEFAULT '',
  thumbnail_url   TEXT DEFAULT '',
  reference_url   TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 7. RAW_IDEAS
CREATE TABLE IF NOT EXISTS public.raw_ideas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  idea_text       TEXT NOT NULL,
  reference_url   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 8. IN_APP_NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  recipient_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user   TEXT,
  title         TEXT NOT NULL DEFAULT 'Notifikasi',
  message       TEXT DEFAULT '',
  type          TEXT NOT NULL DEFAULT 'info',
  post_id       UUID,
  is_read       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 9. PUSH_SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription  JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════════════════
-- C. ENABLE RLS ON ALL TABLES
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_tags        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_ideas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.in_app_notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions    ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════
-- D. HELPER FUNCTIONS (SECURITY DEFINER — prevents infinite recursion)
-- ═══════════════════════════════════════════════════════════════════════

-- Helper: check if current user is member of a workspace
-- SECURITY DEFINER = berjalan sebagai owner, bypass RLS → no recursion
CREATE OR REPLACE FUNCTION public.is_member_of(_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get all workspace IDs that current user is member of
CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF UUID AS $$
  SELECT workspace_id FROM public.workspace_members
  WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if user is owner of workspace
CREATE OR REPLACE FUNCTION public.is_owner_of(_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ═══════════════════════════════════════════════════════════════════════
-- E. ALL RLS POLICIES (menggunakan helper function, AMAN dari recursion)
-- ═══════════════════════════════════════════════════════════════════════

-- ── Profiles ──
CREATE POLICY "Anyone can read profiles" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ── Workspaces ──
CREATE POLICY "Members can read their workspaces" ON public.workspaces
  FOR SELECT USING ( public.is_member_of(id) );
CREATE POLICY "Authenticated users can create workspaces" ON public.workspaces
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Members can update their workspaces" ON public.workspaces
  FOR UPDATE USING ( public.is_member_of(id) );
CREATE POLICY "Members can delete their workspaces" ON public.workspaces
  FOR DELETE USING ( public.is_owner_of(id) );

-- ── Workspace Members (pakai helper function, NO recursion!) ──
CREATE POLICY "Members can read workspace members" ON public.workspace_members
  FOR SELECT USING ( public.is_member_of(workspace_id) );
CREATE POLICY "Authenticated users can insert workspace members" ON public.workspace_members
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Members can update workspace members" ON public.workspace_members
  FOR UPDATE USING ( public.is_member_of(workspace_id) );
CREATE POLICY "Members can delete workspace members" ON public.workspace_members
  FOR DELETE USING ( public.is_member_of(workspace_id) );

-- ── Team Members ──
CREATE POLICY "Authenticated can read team members" ON public.team_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert team members" ON public.team_members
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update team members" ON public.team_members
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete team members" ON public.team_members
  FOR DELETE TO authenticated USING (true);

-- ── Workspace Tags ──
CREATE POLICY "Members can read workspace tags" ON public.workspace_tags
  FOR SELECT USING ( public.is_member_of(workspace_id) );
CREATE POLICY "Members can insert workspace tags" ON public.workspace_tags
  FOR INSERT WITH CHECK ( public.is_member_of(workspace_id) );
CREATE POLICY "Members can update workspace tags" ON public.workspace_tags
  FOR UPDATE USING ( public.is_member_of(workspace_id) );
CREATE POLICY "Members can delete workspace tags" ON public.workspace_tags
  FOR DELETE USING ( public.is_member_of(workspace_id) );

-- ── Posts ──
CREATE POLICY "Allow members to read posts" ON public.posts
  FOR SELECT USING ( public.is_member_of(workspace_id) );
CREATE POLICY "Allow members to insert posts" ON public.posts
  FOR INSERT WITH CHECK ( public.is_member_of(workspace_id) );
CREATE POLICY "Allow members to update posts" ON public.posts
  FOR UPDATE USING ( public.is_member_of(workspace_id) );
CREATE POLICY "Allow members to delete posts" ON public.posts
  FOR DELETE USING ( public.is_member_of(workspace_id) );

-- ── Raw Ideas ──
CREATE POLICY "Allow members to read raw ideas" ON public.raw_ideas
  FOR SELECT USING ( public.is_member_of(workspace_id) );
CREATE POLICY "Allow members to insert raw ideas" ON public.raw_ideas
  FOR INSERT WITH CHECK ( public.is_member_of(workspace_id) );
CREATE POLICY "Allow members to update raw ideas" ON public.raw_ideas
  FOR UPDATE USING ( public.is_member_of(workspace_id) );
CREATE POLICY "Allow members to delete raw ideas" ON public.raw_ideas
  FOR DELETE USING ( public.is_member_of(workspace_id) );

-- ── In-App Notifications ──
CREATE POLICY "Users can read own notifications" ON public.in_app_notifications
  FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.in_app_notifications
  FOR UPDATE USING (recipient_id = auth.uid());
CREATE POLICY "Users can delete own notifications" ON public.in_app_notifications
  FOR DELETE USING (recipient_id = auth.uid());
CREATE POLICY "Authenticated can insert notifications" ON public.in_app_notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── Push Subscriptions ──
CREATE POLICY "Users can read own subscriptions" ON public.push_subscriptions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own subscriptions" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own subscriptions" ON public.push_subscriptions
  FOR DELETE USING (user_id = auth.uid());


-- ═══════════════════════════════════════════════════════════════════════
-- F. TRIGGER FUNCTIONS + TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════

-- F1. Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- F2. Handle New User — auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, updated_at)
  VALUES (NEW.id, NEW.email, now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- F3. Sync team_members workspace_id saat member join
CREATE OR REPLACE FUNCTION public.sync_team_member_workspace()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.team_members
  SET workspace_id = NEW.workspace_id
  WHERE email = NEW.user_name
    AND (workspace_id IS NULL OR workspace_id != NEW.workspace_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Triggers ──
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS sync_team_on_workspace_join ON public.workspace_members;
CREATE TRIGGER sync_team_on_workspace_join
  AFTER INSERT ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_team_member_workspace();


-- ═══════════════════════════════════════════════════════════════════════
-- G. INDEXES
-- ═══════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id      ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_name    ON public.workspace_members(user_name);
CREATE INDEX IF NOT EXISTS idx_posts_workspace_id ON public.posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_posts_status       ON public.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_deadline     ON public.posts(deadline);
CREATE INDEX IF NOT EXISTS idx_posts_created_at   ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_pic          ON public.posts(pic);
CREATE INDEX IF NOT EXISTS idx_raw_ideas_workspace_id ON public.raw_ideas(workspace_id);
CREATE INDEX IF NOT EXISTS idx_raw_ideas_created_at   ON public.raw_ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_tags_workspace_id ON public.workspace_tags(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tags_category     ON public.workspace_tags(category);
CREATE INDEX IF NOT EXISTS idx_team_members_email   ON public.team_members(email);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_name    ON public.team_members(name);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.in_app_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id ON public.in_app_notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type         ON public.in_app_notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read      ON public.in_app_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at   ON public.in_app_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_type_read
  ON public.in_app_notifications(recipient_id, type, is_read);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);


-- ═══════════════════════════════════════════════════════════════════════
-- H. PUBLICATIONS (Realtime)
-- ═══════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'in_app_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════
-- I. STORAGE BUCKET + POLICIES
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read for avatars' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public read for avatars"
      ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can upload avatars' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Auth users can upload avatars"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can update their avatars' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Auth users can update their avatars"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can delete their avatars' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Auth users can delete their avatars"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'avatars');
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════
-- J. GRANTS
-- ═══════════════════════════════════════════════════════════════════════
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;


-- ═══════════════════════════════════════════════════════════════════════
-- ✅ SELESAI!
-- ═══════════════════════════════════════════════════════════════════════
--   [x] Extensions (4)    — uuid-ossp, pgcrypto, pg_trgm, pgjwt
--   [x] Tables (9)        — all core tables
--   [x] Helper Fn (3)     — is_member_of, get_my_workspace_ids, is_owner_of
--   [x] RLS Policies      — anti-recursion via SECURITY DEFINER helpers
--   [x] Trigger Fn (3)    — set_updated_at, handle_new_user, sync_team_member
--   [x] Triggers (3)      — on signup, on profile update, on workspace join
--   [x] Indexes (18)      — all hot columns
--   [x] Publications      — Realtime for notifications
--   [x] Storage           — avatars bucket + 4 policies
--   [x] Grants            — anon, authenticated, service_role
-- =====================================================================
