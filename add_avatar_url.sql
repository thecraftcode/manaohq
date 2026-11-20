-- =====================================================
-- Migration: Add avatar_url to team_members + Storage bucket
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Add avatar_url column to team_members
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Create the "avatars" storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies: anyone can read, authenticated users can upload/update/delete their own
CREATE POLICY "Public read for avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Auth users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Auth users can update their avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Auth users can delete their avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
