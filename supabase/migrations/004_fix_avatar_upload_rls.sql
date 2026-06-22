-- ============================================================
-- TALENDRO ROP — FIX: profile photo upload RLS violation
--
-- BUG: ProfileCompletionModal.tsx uploaded user avatar photos into the
-- 'company-assets' bucket, but that bucket's INSERT policy is admin-only
-- (it was designed for company branding/logo assets). Every non-admin
-- recruiter completing their mandatory profile hit:
--   "new row violates row-level security policy"
-- on the photo upload step, blocking them from ever reaching the dashboard.
--
-- FIX: a dedicated 'avatars' bucket, public read, where any approved user
-- may write ONLY to their own folder (cannot overwrite another user's
-- avatar). company-assets' admin-only policy is left untouched.
--
-- Run this directly in your Supabase SQL Editor against your live project.
-- Idempotent — safe to re-run.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
CREATE POLICY "avatars_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND is_approved_user()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin())
  );
