-- ============================================================
-- TALENDRO ROP - COMPLETE SUPABASE SQL MIGRATION
-- Run this entire script in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'recruiter' CHECK (role IN ('admin', 'recruiter')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'inactive')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. CLIENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  industry TEXT,
  address TEXT,
  gst_number TEXT,
  sla_details TEXT,
  contract_details TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. VENDORS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  mobile TEXT,
  location TEXT,
  gst_number TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. REQUIREMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fg_id TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  requirement_title TEXT NOT NULL,
  category TEXT,
  mandatory_skills TEXT[] NOT NULL DEFAULT '{}',
  secondary_skills TEXT[] NOT NULL DEFAULT '{}',
  experience_min NUMERIC(4,1),
  experience_max NUMERIC(4,1),
  location TEXT,
  openings INTEGER NOT NULL DEFAULT 1,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'hold', 'closed', 'filled')),
  jd_url TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. CANDIDATES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL UNIQUE,
  email_address TEXT NOT NULL UNIQUE,
  pan_number TEXT,
  date_of_birth DATE,
  current_location TEXT,
  preferred_location TEXT,
  total_experience NUMERIC(4,1),
  relevant_experience NUMERIC(4,1),
  skills TEXT[] NOT NULL DEFAULT '{}',
  current_employer TEXT,
  current_ctc BIGINT,
  expected_ctc BIGINT,
  notice_period INTEGER,
  can_join_within INTEGER,
  highest_qualification TEXT,
  university TEXT,
  passing_year INTEGER,
  resume_url TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. CANDIDATE DOCUMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS candidate_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'other' CHECK (document_type IN ('resume', 'offer_letter', 'id_proof', 'certificate', 'other')),
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. CANDIDATE NOTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS candidate_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. SUBMISSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  partner_name TEXT,
  status TEXT NOT NULL DEFAULT 'sourced' CHECK (status IN (
    'sourced','submitted','shortlisted','interview_scheduled',
    'l1_cleared','l2_cleared','final_round','offered','joined','rejected'
  )),
  notes TEXT,
  submitted_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requirement_id, candidate_id)
);

-- ============================================================
-- 9. CANDIDATE STAGE HISTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS candidate_stage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  notes TEXT,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. INTERVIEWS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  interview_date DATE NOT NULL,
  interview_time TIME,
  interview_round TEXT NOT NULL DEFAULT 'L1',
  interview_mode TEXT DEFAULT 'video' CHECK (interview_mode IN ('video', 'phone', 'in_person')),
  interviewer TEXT,
  feedback TEXT,
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','cleared','rejected','on_hold','no_show')),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. OFFERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  offer_date DATE,
  offered_ctc BIGINT,
  joining_date DATE,
  offer_letter_url TEXT,
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered','accepted','declined','joined','no_show','deferred')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. TEAMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_name TEXT NOT NULL,
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13. TEAM MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_in_team TEXT DEFAULT 'recruiter',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- ============================================================
-- 14. TARGETS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('daily','weekly','monthly','quarterly','yearly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_submissions INTEGER DEFAULT 0,
  target_interviews INTEGER DEFAULT 0,
  target_offers INTEGER DEFAULT 0,
  target_joinings INTEGER DEFAULT 0,
  actual_submissions INTEGER DEFAULT 0,
  actual_interviews INTEGER DEFAULT 0,
  actual_offers INTEGER DEFAULT 0,
  actual_joinings INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 15. ACTIVITY LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  role TEXT NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  record_id UUID,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 16. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_submissions_candidate ON submissions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_submissions_requirement ON submissions(requirement_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_by ON submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_submissions_date ON submissions(submission_date DESC);

CREATE INDEX IF NOT EXISTS idx_candidates_mobile ON candidates(mobile_number);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email_address);
CREATE INDEX IF NOT EXISTS idx_candidates_skills ON candidates USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_candidates_created ON candidates(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requirements_fg_id ON requirements(fg_id);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);
CREATE INDEX IF NOT EXISTS idx_requirements_client ON requirements(client_id);

CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_date ON interviews(interview_date DESC);
CREATE INDEX IF NOT EXISTS idx_interviews_submission ON interviews(submission_id);

CREATE INDEX IF NOT EXISTS idx_offers_candidate ON offers(candidate_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stage_history_submission ON candidate_stage_history(submission_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_candidate ON candidate_stage_history(candidate_id);

CREATE INDEX IF NOT EXISTS idx_targets_user ON targets(user_id, period_start);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','clients','vendors','requirements','candidates',
    'submissions','interviews','offers','teams','targets'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;
       CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      t, t, t, t
    );
  END LOOP;
END;
$$;

-- ============================================================
-- STAGE HISTORY TRIGGER — auto-log status changes on submissions
-- ============================================================
CREATE OR REPLACE FUNCTION log_submission_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO candidate_stage_history (
      submission_id, candidate_id, from_status, to_status, changed_by
    ) VALUES (
      NEW.id, NEW.candidate_id, OLD.status, NEW.status, NEW.submitted_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_submission_stage ON submissions;
CREATE TRIGGER trg_submission_stage
AFTER UPDATE ON submissions
FOR EACH ROW EXECUTE FUNCTION log_submission_stage_change();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'recruiter'),
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'recruiter') = 'admin' THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTION: Check if user is approved
-- ============================================================
CREATE OR REPLACE FUNCTION is_approved_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- RLS POLICIES — PROFILES
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "profiles_admin_select_all" ON profiles;
CREATE POLICY "profiles_admin_select_all" ON profiles
  FOR SELECT USING (is_admin());

-- ============================================================
-- RLS POLICIES — CLIENTS (all approved users can read/write)
-- ============================================================
DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (is_approved_user());

DROP POLICY IF EXISTS "clients_insert" ON clients;
CREATE POLICY "clients_insert" ON clients
  FOR INSERT WITH CHECK (is_approved_user());

DROP POLICY IF EXISTS "clients_update" ON clients;
CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (is_approved_user());

DROP POLICY IF EXISTS "clients_delete" ON clients;
CREATE POLICY "clients_delete" ON clients
  FOR DELETE USING (is_admin());

-- ============================================================
-- RLS POLICIES — VENDORS
-- ============================================================
DROP POLICY IF EXISTS "vendors_select" ON vendors;
CREATE POLICY "vendors_select" ON vendors
  FOR SELECT USING (is_approved_user());

DROP POLICY IF EXISTS "vendors_insert" ON vendors;
CREATE POLICY "vendors_insert" ON vendors
  FOR INSERT WITH CHECK (is_approved_user());

DROP POLICY IF EXISTS "vendors_update" ON vendors;
CREATE POLICY "vendors_update" ON vendors
  FOR UPDATE USING (is_approved_user());

DROP POLICY IF EXISTS "vendors_delete" ON vendors;
CREATE POLICY "vendors_delete" ON vendors
  FOR DELETE USING (is_admin());

-- ============================================================
-- RLS POLICIES — REQUIREMENTS
-- ============================================================
DROP POLICY IF EXISTS "requirements_select" ON requirements;
CREATE POLICY "requirements_select" ON requirements
  FOR SELECT USING (is_approved_user());

DROP POLICY IF EXISTS "requirements_insert" ON requirements;
CREATE POLICY "requirements_insert" ON requirements
  FOR INSERT WITH CHECK (is_approved_user());

DROP POLICY IF EXISTS "requirements_update" ON requirements;
CREATE POLICY "requirements_update" ON requirements
  FOR UPDATE USING (is_approved_user());

DROP POLICY IF EXISTS "requirements_delete" ON requirements;
CREATE POLICY "requirements_delete" ON requirements
  FOR DELETE USING (is_approved_user());

-- ============================================================
-- RLS POLICIES — CANDIDATES (shared workspace)
-- ============================================================
DROP POLICY IF EXISTS "candidates_select" ON candidates;
CREATE POLICY "candidates_select" ON candidates
  FOR SELECT USING (is_approved_user());

DROP POLICY IF EXISTS "candidates_insert" ON candidates;
CREATE POLICY "candidates_insert" ON candidates
  FOR INSERT WITH CHECK (is_approved_user());

DROP POLICY IF EXISTS "candidates_update" ON candidates;
CREATE POLICY "candidates_update" ON candidates
  FOR UPDATE USING (is_approved_user());

DROP POLICY IF EXISTS "candidates_delete" ON candidates;
CREATE POLICY "candidates_delete" ON candidates
  FOR DELETE USING (is_approved_user());

-- ============================================================
-- RLS POLICIES — CANDIDATE DOCUMENTS
-- ============================================================
DROP POLICY IF EXISTS "candidate_documents_select" ON candidate_documents;
CREATE POLICY "candidate_documents_select" ON candidate_documents
  FOR SELECT USING (is_approved_user());

DROP POLICY IF EXISTS "candidate_documents_insert" ON candidate_documents;
CREATE POLICY "candidate_documents_insert" ON candidate_documents
  FOR INSERT WITH CHECK (is_approved_user());

DROP POLICY IF EXISTS "candidate_documents_delete" ON candidate_documents;
CREATE POLICY "candidate_documents_delete" ON candidate_documents
  FOR DELETE USING (is_approved_user());

-- ============================================================
-- RLS POLICIES — CANDIDATE NOTES
-- ============================================================
DROP POLICY IF EXISTS "candidate_notes_select" ON candidate_notes;
CREATE POLICY "candidate_notes_select" ON candidate_notes
  FOR SELECT USING (is_approved_user());

DROP POLICY IF EXISTS "candidate_notes_insert" ON candidate_notes;
CREATE POLICY "candidate_notes_insert" ON candidate_notes
  FOR INSERT WITH CHECK (is_approved_user());

DROP POLICY IF EXISTS "candidate_notes_delete" ON candidate_notes;
CREATE POLICY "candidate_notes_delete" ON candidate_notes
  FOR DELETE USING (created_by = auth.uid() OR is_admin());

-- ============================================================
-- RLS POLICIES — SUBMISSIONS (shared workspace)
-- ============================================================
DROP POLICY IF EXISTS "submissions_select" ON submissions;
CREATE POLICY "submissions_select" ON submissions
  FOR SELECT USING (is_approved_user());

DROP POLICY IF EXISTS "submissions_insert" ON submissions;
CREATE POLICY "submissions_insert" ON submissions
  FOR INSERT WITH CHECK (is_approved_user());

DROP POLICY IF EXISTS "submissions_update" ON submissions;
CREATE POLICY "submissions_update" ON submissions
  FOR UPDATE USING (is_approved_user());

DROP POLICY IF EXISTS "submissions_delete" ON submissions;
CREATE POLICY "submissions_delete" ON submissions
  FOR DELETE USING (is_admin());

-- ============================================================
-- RLS POLICIES — CANDIDATE STAGE HISTORY
-- ============================================================
DROP POLICY IF EXISTS "stage_history_select" ON candidate_stage_history;
CREATE POLICY "stage_history_select" ON candidate_stage_history
  FOR SELECT USING (is_approved_user());

DROP POLICY IF EXISTS "stage_history_insert" ON candidate_stage_history;
CREATE POLICY "stage_history_insert" ON candidate_stage_history
  FOR INSERT WITH CHECK (is_approved_user());

-- ============================================================
-- RLS POLICIES — INTERVIEWS
-- ============================================================
DROP POLICY IF EXISTS "interviews_select" ON interviews;
CREATE POLICY "interviews_select" ON interviews
  FOR SELECT USING (is_approved_user());

DROP POLICY IF EXISTS "interviews_insert" ON interviews;
CREATE POLICY "interviews_insert" ON interviews
  FOR INSERT WITH CHECK (is_approved_user());

DROP POLICY IF EXISTS "interviews_update" ON interviews;
CREATE POLICY "interviews_update" ON interviews
  FOR UPDATE USING (is_approved_user());

DROP POLICY IF EXISTS "interviews_delete" ON interviews;
CREATE POLICY "interviews_delete" ON interviews
  FOR DELETE USING (is_admin());

-- ============================================================
-- RLS POLICIES — OFFERS
-- ============================================================
DROP POLICY IF EXISTS "offers_select" ON offers;
CREATE POLICY "offers_select" ON offers
  FOR SELECT USING (is_approved_user());

DROP POLICY IF EXISTS "offers_insert" ON offers;
CREATE POLICY "offers_insert" ON offers
  FOR INSERT WITH CHECK (is_approved_user());

DROP POLICY IF EXISTS "offers_update" ON offers;
CREATE POLICY "offers_update" ON offers
  FOR UPDATE USING (is_approved_user());

DROP POLICY IF EXISTS "offers_delete" ON offers;
CREATE POLICY "offers_delete" ON offers
  FOR DELETE USING (is_admin());

-- ============================================================
-- RLS POLICIES — TEAMS
-- ============================================================
DROP POLICY IF EXISTS "teams_select" ON teams;
CREATE POLICY "teams_select" ON teams
  FOR SELECT USING (is_approved_user());

DROP POLICY IF EXISTS "teams_insert" ON teams;
CREATE POLICY "teams_insert" ON teams
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "teams_update" ON teams;
CREATE POLICY "teams_update" ON teams
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "teams_delete" ON teams;
CREATE POLICY "teams_delete" ON teams
  FOR DELETE USING (is_admin());

-- ============================================================
-- RLS POLICIES — TEAM MEMBERS
-- ============================================================
DROP POLICY IF EXISTS "team_members_select" ON team_members;
CREATE POLICY "team_members_select" ON team_members
  FOR SELECT USING (is_approved_user());

DROP POLICY IF EXISTS "team_members_insert" ON team_members;
CREATE POLICY "team_members_insert" ON team_members
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "team_members_delete" ON team_members;
CREATE POLICY "team_members_delete" ON team_members
  FOR DELETE USING (is_admin());

-- ============================================================
-- RLS POLICIES — TARGETS
-- ============================================================
DROP POLICY IF EXISTS "targets_select" ON targets;
CREATE POLICY "targets_select" ON targets
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "targets_insert" ON targets;
CREATE POLICY "targets_insert" ON targets
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "targets_update" ON targets;
CREATE POLICY "targets_update" ON targets
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "targets_delete" ON targets;
CREATE POLICY "targets_delete" ON targets
  FOR DELETE USING (is_admin());

-- ============================================================
-- RLS POLICIES — ACTIVITY LOGS (admin reads all, everyone inserts)
-- ============================================================
DROP POLICY IF EXISTS "activity_logs_select" ON activity_logs;
CREATE POLICY "activity_logs_select" ON activity_logs
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "activity_logs_insert" ON activity_logs;
CREATE POLICY "activity_logs_insert" ON activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- RLS POLICIES — NOTIFICATIONS (own only)
-- ============================================================
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('resumes', 'resumes', true, 10485760,
    ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('jd-files', 'jd-files', true, 10485760,
    ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('candidate-documents', 'candidate-documents', true, 10485760,
    ARRAY['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('company-assets', 'company-assets', true, 5242880,
    ARRAY['image/jpeg','image/png','image/svg+xml','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE RLS POLICIES
-- ============================================================

-- RESUMES bucket
DROP POLICY IF EXISTS "resumes_select" ON storage.objects;
CREATE POLICY "resumes_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'resumes' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "resumes_insert" ON storage.objects;
CREATE POLICY "resumes_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'resumes' AND auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'approved')
  );

DROP POLICY IF EXISTS "resumes_update" ON storage.objects;
CREATE POLICY "resumes_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'resumes' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "resumes_delete" ON storage.objects;
CREATE POLICY "resumes_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'resumes' AND auth.role() = 'authenticated');

-- JD-FILES bucket
DROP POLICY IF EXISTS "jd_files_select" ON storage.objects;
CREATE POLICY "jd_files_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'jd-files' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "jd_files_insert" ON storage.objects;
CREATE POLICY "jd_files_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'jd-files' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "jd_files_delete" ON storage.objects;
CREATE POLICY "jd_files_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'jd-files' AND auth.role() = 'authenticated');

-- CANDIDATE DOCUMENTS bucket
DROP POLICY IF EXISTS "candidate_docs_select" ON storage.objects;
CREATE POLICY "candidate_docs_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'candidate-documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "candidate_docs_insert" ON storage.objects;
CREATE POLICY "candidate_docs_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'candidate-documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "candidate_docs_delete" ON storage.objects;
CREATE POLICY "candidate_docs_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'candidate-documents' AND auth.role() = 'authenticated');

-- COMPANY ASSETS bucket (admin only write)
DROP POLICY IF EXISTS "company_assets_select" ON storage.objects;
CREATE POLICY "company_assets_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-assets');

DROP POLICY IF EXISTS "company_assets_insert" ON storage.objects;
CREATE POLICY "company_assets_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'company-assets'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- SEED FIRST ADMIN USER
-- NOTE: After running this migration, create your first user via
-- Supabase Auth → Users → Add User, then run:
-- UPDATE profiles SET role = 'admin', status = 'approved'
-- WHERE email = 'your-admin@email.com';
-- ============================================================

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;
