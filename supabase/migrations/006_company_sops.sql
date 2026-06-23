-- ============================================================
-- TALENDRO ROP — COMPANY SOPs
-- Admin-uploaded Standard Operating Procedure documents, viewable by any
-- approved user (recruiters need to read them; only admins can publish
-- them). Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS company_sops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_sops_created ON company_sops(created_at DESC);

DROP TRIGGER IF EXISTS trg_company_sops_updated_at ON company_sops;
CREATE TRIGGER trg_company_sops_updated_at
BEFORE UPDATE ON company_sops
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE company_sops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_sops_select" ON company_sops;
CREATE POLICY "company_sops_select" ON company_sops
  FOR SELECT USING (is_approved_user());

DROP POLICY IF EXISTS "company_sops_insert" ON company_sops;
CREATE POLICY "company_sops_insert" ON company_sops
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "company_sops_update" ON company_sops;
CREATE POLICY "company_sops_update" ON company_sops
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "company_sops_delete" ON company_sops;
CREATE POLICY "company_sops_delete" ON company_sops
  FOR DELETE USING (is_admin());

-- Storage: private bucket, admin-only write, approved-user read via signed
-- URLs (same pattern as resumes/jd-files/candidate-documents — internal
-- company documents aren't candidate PII, but there's no reason to make
-- them publicly fetchable by an unauthenticated visitor either).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-sops', 'company-sops', false, 20971520,
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "company_sops_storage_select" ON storage.objects;
CREATE POLICY "company_sops_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-sops' AND is_approved_user());

DROP POLICY IF EXISTS "company_sops_storage_insert" ON storage.objects;
CREATE POLICY "company_sops_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'company-sops' AND is_admin());

DROP POLICY IF EXISTS "company_sops_storage_delete" ON storage.objects;
CREATE POLICY "company_sops_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'company-sops' AND is_admin());
