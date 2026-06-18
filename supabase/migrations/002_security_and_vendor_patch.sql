-- ============================================================
-- TALENDRO ROP - SECURITY & VENDOR-FLOW PATCH
-- Run this AFTER 001_complete_schema.sql if your project was already
-- created from the original (pre-remediation) version of that file.
-- If you are setting up a brand-new project, just run the updated
-- 001_complete_schema.sql — it already includes everything below.
-- This script is idempotent and safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. VENDOR FLOW — give submissions a real FK to vendors
-- ============================================================
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_vendor ON submissions(vendor_id);

-- Best-effort backfill: match existing free-text partner_name to a vendor by name.
UPDATE submissions s
SET vendor_id = v.id
FROM vendors v
WHERE s.vendor_id IS NULL
  AND s.partner_name IS NOT NULL
  AND lower(trim(s.partner_name)) = lower(trim(v.vendor_name));

-- ============================================================
-- 2. DATA INTEGRITY — DB-level constraints matching client Zod rules
-- ============================================================
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS chk_pan_format;
ALTER TABLE candidates ADD CONSTRAINT chk_pan_format
  CHECK (pan_number IS NULL OR pan_number = '' OR pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$');
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS chk_current_ctc_nonneg;
ALTER TABLE candidates ADD CONSTRAINT chk_current_ctc_nonneg
  CHECK (current_ctc IS NULL OR current_ctc >= 0);
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS chk_expected_ctc_nonneg;
ALTER TABLE candidates ADD CONSTRAINT chk_expected_ctc_nonneg
  CHECK (expected_ctc IS NULL OR expected_ctc >= 0);
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS chk_notice_period_nonneg;
ALTER TABLE candidates ADD CONSTRAINT chk_notice_period_nonneg
  CHECK (notice_period IS NULL OR notice_period >= 0);

-- ============================================================
-- 3. CRITICAL — fix privilege-escalation hole in profiles RLS
-- Previously "profiles_update_own" had no WITH CHECK, so any signed-up
-- user (including one still pending approval) could update their own
-- role to 'admin' and status to 'approved'.
-- ============================================================
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
    AND status = (SELECT p.status FROM profiles p WHERE p.id = auth.uid())
  );

-- ============================================================
-- 3b. CRITICAL — handle_new_user() previously trusted a client-supplied
-- "role" value from auth signup metadata (raw_user_meta_data->>'role'),
-- and auto-approved it if 'admin'. Anyone could call
-- supabase.auth.signUp({ options: { data: { role: 'admin' } } }) directly
-- and receive a fully approved admin account with NO further exploit
-- needed — a more direct bypass than the RLS hole above. New signups are
-- now unconditionally created as role='recruiter', status='pending'.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'recruiter',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- (trigger itself is unchanged — CREATE OR REPLACE FUNCTION above is sufficient
-- since the trigger already points at handle_new_user())

-- ============================================================
-- 4. HIGH — notifications could previously be written to ANY user's
-- inbox by ANY authenticated user (WITH CHECK (true)).
-- ============================================================
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

-- ============================================================
-- 5. CRITICAL — make PII storage buckets private.
-- Public buckets bypass storage.objects RLS entirely for reads,
-- which exposed resumes / ID proofs / offer letters (with CTC) to
-- anyone with the URL, with no authentication.
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id IN ('resumes', 'jd-files', 'candidate-documents');
-- company-assets (logos/branding) intentionally remains public.

-- Re-create storage policies to also require approved status, not just
-- "authenticated", and to match the now-private buckets.
DROP POLICY IF EXISTS "resumes_select" ON storage.objects;
CREATE POLICY "resumes_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'resumes' AND is_approved_user());
DROP POLICY IF EXISTS "resumes_insert" ON storage.objects;
CREATE POLICY "resumes_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'resumes' AND is_approved_user());
DROP POLICY IF EXISTS "resumes_update" ON storage.objects;
CREATE POLICY "resumes_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'resumes' AND is_approved_user());
DROP POLICY IF EXISTS "resumes_delete" ON storage.objects;
CREATE POLICY "resumes_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'resumes' AND is_approved_user());

DROP POLICY IF EXISTS "jd_files_select" ON storage.objects;
CREATE POLICY "jd_files_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'jd-files' AND is_approved_user());
DROP POLICY IF EXISTS "jd_files_insert" ON storage.objects;
CREATE POLICY "jd_files_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'jd-files' AND is_approved_user());
DROP POLICY IF EXISTS "jd_files_delete" ON storage.objects;
CREATE POLICY "jd_files_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'jd-files' AND is_approved_user());

DROP POLICY IF EXISTS "candidate_docs_select" ON storage.objects;
CREATE POLICY "candidate_docs_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'candidate-documents' AND is_approved_user());
DROP POLICY IF EXISTS "candidate_docs_insert" ON storage.objects;
CREATE POLICY "candidate_docs_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'candidate-documents' AND is_approved_user());
DROP POLICY IF EXISTS "candidate_docs_delete" ON storage.objects;
CREATE POLICY "candidate_docs_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'candidate-documents' AND is_approved_user());

-- ============================================================
-- NOTE ON EXISTING DATA: any file_url / resume_url / offer_letter_url
-- values already stored from getPublicUrl() calls made before this
-- patch will stop resolving once the bucket is private. The
-- application code has been updated to generate fresh signed URLs at
-- read-time instead of storing permanent public URLs, but already
-- stored URLs in candidate_documents.file_url / candidates.resume_url
-- / offers.offer_letter_url should be treated as storage *paths* going
-- forward — see storageService in src/lib/services.ts.
-- ============================================================
