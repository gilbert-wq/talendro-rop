-- ============================================================
-- TALENDRO ROP — BUSINESS HEAD ROLE, CLIENT VISIBILITY LOCKDOWN,
-- AND REQUIREMENT ASSIGNMENT WORKFLOW
--
-- Adds a third role, 'business_head' (covers "Business Head / CEO / TL"
-- from the request — one role value, since they describe one job
-- function, not three separate permission tiers). A business_head is
-- leadership-equivalent for client visibility, requirement management,
-- and recruiter-profile access, but is deliberately NOT admin-equivalent
-- for system administration (user approval, settings, login-session/
-- attendance data) unless explicitly extended later.
--
-- SECURITY FIX: clients_select was `is_approved_user()` — ANY recruiter
-- could read the full client portfolio. This is now leadership-only
-- (admin or business_head). Because requirements(*, clients(client_name))
-- is a PostgREST EMBEDDED join, a recruiter's existing query doesn't need
-- to change at all — RLS on the embedded `clients` table now makes that
-- nested object resolve to null for them automatically.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ============================================================
-- 1. NEW ROLE
-- ============================================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'recruiter', 'business_head'));

CREATE OR REPLACE FUNCTION is_leadership()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'business_head') AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- 2. CLIENT VISIBILITY LOCKDOWN — leadership only
-- ============================================================
DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (is_leadership());

DROP POLICY IF EXISTS "clients_insert" ON clients;
CREATE POLICY "clients_insert" ON clients
  FOR INSERT WITH CHECK (is_leadership());

DROP POLICY IF EXISTS "clients_update" ON clients;
CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (is_leadership());
-- clients_delete stays admin-only (unchanged) as an extra safety margin
-- on top of is_leadership() for a destructive action.

-- ============================================================
-- 2b. VENDOR VISIBILITY LOCKDOWN — leadership only. Recruiters keep full
-- candidate/submission/interview/offer access (that's their core job) but
-- lose vendor management AND the ability to resolve a vendor's name,
-- mobile, or email at all. Because submissions.vendor_id is just a foreign
-- key, a recruiter creating/viewing a submission is unaffected — only the
-- embedded `vendors(vendor_name)` join (and the vendor picker dropdown,
-- which queries the same RLS-protected table) resolve to nothing for them
-- now, same mechanism as the clients lockdown above.
-- ============================================================
DROP POLICY IF EXISTS "vendors_select" ON vendors;
CREATE POLICY "vendors_select" ON vendors
  FOR SELECT USING (is_leadership());

DROP POLICY IF EXISTS "vendors_insert" ON vendors;
CREATE POLICY "vendors_insert" ON vendors
  FOR INSERT WITH CHECK (is_leadership());

DROP POLICY IF EXISTS "vendors_update" ON vendors;
CREATE POLICY "vendors_update" ON vendors
  FOR UPDATE USING (is_leadership());
-- vendors_delete stays admin-only (unchanged).

-- Data cleanup: partner_name (plain text, readable by recruiters via
-- submissions_select) previously got the selected vendor's name copied
-- into it automatically whenever vendor_id was set — leaking the vendor's
-- identity right back around this lockdown. The frontend no longer does
-- this going forward; this clears out anything already leaked that way.
UPDATE submissions SET partner_name = NULL WHERE vendor_id IS NOT NULL;

-- ============================================================
-- 3. REQUIREMENT MANAGEMENT LOCKDOWN — leadership only for
-- create/edit/delete. SELECT stays is_approved_user(): recruiters still
-- need to see open requirements to work their pipelines, just with a
-- narrowed column set enforced at the application layer (no client name —
-- which, again, the clients RLS above already guarantees server-side).
-- ============================================================
DROP POLICY IF EXISTS "requirements_insert" ON requirements;
CREATE POLICY "requirements_insert" ON requirements
  FOR INSERT WITH CHECK (is_leadership());

DROP POLICY IF EXISTS "requirements_update" ON requirements;
CREATE POLICY "requirements_update" ON requirements
  FOR UPDATE USING (is_leadership());

DROP POLICY IF EXISTS "requirements_delete" ON requirements;
CREATE POLICY "requirements_delete" ON requirements
  FOR DELETE USING (is_leadership());

-- ============================================================
-- 4b. CANDIDATE REMARKS TIMELINE — candidate_notes already exists with
-- exactly the right shape (note text + created_by + created_at, which
-- doubles as both date and time); just needs a status tag added. RLS is
-- already correct (any approved user — i.e. recruiters too — can add and
-- read notes; only the author or an admin can delete one) and needs no
-- change.
-- ============================================================
ALTER TABLE candidate_notes ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE candidate_notes DROP CONSTRAINT IF EXISTS chk_candidate_notes_status;
ALTER TABLE candidate_notes ADD CONSTRAINT chk_candidate_notes_status
  CHECK (status IS NULL OR status IN ('contacted', 'follow_up', 'interested', 'not_interested', 'on_hold', 'no_response'));
CREATE INDEX IF NOT EXISTS idx_candidate_notes_candidate ON candidate_notes(candidate_id, created_at DESC);

-- ============================================================
-- 4. REQUIREMENT ASSIGNMENT WORKFLOW
-- ============================================================
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS deadline_date DATE;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_requirements_assigned_to ON requirements(assigned_to);
CREATE INDEX IF NOT EXISTS idx_requirements_deadline ON requirements(deadline_date);

-- Notify + log when a requirement is (re-)assigned. SECURITY DEFINER is
-- required here, not just convention: a business_head assigning a
-- requirement needs to create a notification for the recruiter, but
-- notifications_insert's RLS (see below) only allows inserting your own
-- row or an admin's — a plain business_head insert would otherwise be
-- blocked. This trigger only ever touches NEW.assigned_to / NEW.id, both
-- fixed by the row being updated, so there's no injection surface.
CREATE OR REPLACE FUNCTION notify_requirement_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO notifications (user_id, title, message, type, read)
    VALUES (
      NEW.assigned_to,
      'New requirement assigned',
      'You have been assigned to ' || NEW.requirement_title || ' (' || NEW.fg_id || ')',
      'info',
      false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_requirement_assignment ON requirements;
CREATE TRIGGER trg_notify_requirement_assignment
AFTER UPDATE OF assigned_to ON requirements
FOR EACH ROW EXECUTE FUNCTION notify_requirement_assignment();

-- Also fire on INSERT in case a requirement is created already assigned.
CREATE OR REPLACE FUNCTION notify_requirement_assignment_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, read)
    VALUES (
      NEW.assigned_to,
      'New requirement assigned',
      'You have been assigned to ' || NEW.requirement_title || ' (' || NEW.fg_id || ')',
      'info',
      false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_requirement_assignment_insert ON requirements;
CREATE TRIGGER trg_notify_requirement_assignment_insert
AFTER INSERT ON requirements
FOR EACH ROW EXECUTE FUNCTION notify_requirement_assignment_on_insert();

-- Broaden notifications_insert so leadership (not just admin) can trigger
-- the system notifications above, and any other leadership-driven
-- notification going forward, without each one needing its own
-- SECURITY DEFINER trigger as a workaround.
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_leadership());

-- ============================================================
-- 5. RECRUITER PROFILE CARD / INSIGHTS — extend from admin-only to
-- leadership (Feature request: "view recruiter profile access should be
-- given to Leadership role"). Each RPC already does
-- `is_admin() OR p_user_id = auth.uid()`; broadening to is_leadership()
-- additionally covers admin so the is_admin() check itself is now
-- redundant but kept removed for clarity.
-- ============================================================
CREATE OR REPLACE FUNCTION get_recruiter_profile_summary(p_user_id UUID)
RETURNS TABLE (
  id UUID, full_name TEXT, email TEXT, employee_id TEXT, phone TEXT, alternate_phone TEXT,
  department TEXT, designation TEXT, reporting_manager_name TEXT, date_of_joining DATE,
  date_of_birth DATE, gender TEXT, current_address TEXT, permanent_address TEXT,
  emergency_contact_name TEXT, emergency_contact_number TEXT, avatar_url TEXT,
  education TEXT, experience_years NUMERIC, status TEXT, role TEXT,
  last_login_at TIMESTAMPTZ, created_at TIMESTAMPTZ, profile_completion_percentage INTEGER
) AS $$
BEGIN
  IF NOT (is_leadership() OR p_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.employee_id, p.phone, p.alternate_phone,
    p.department, p.designation, m.full_name, p.date_of_joining,
    p.date_of_birth, p.gender, p.current_address, p.permanent_address,
    p.emergency_contact_name, p.emergency_contact_number, p.avatar_url,
    p.education, p.experience_years, p.status, p.role,
    p.last_login_at, p.created_at, p.profile_completion_percentage
  FROM profiles p
  LEFT JOIN profiles m ON m.id = p.reporting_manager
  WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_recruiter_performance(p_user_id UUID)
RETURNS TABLE (
  candidates_added BIGINT, candidates_joined BIGINT, submissions_made BIGINT,
  interviews_scheduled BIGINT, interviews_cleared BIGINT,
  offers_released BIGINT, offers_accepted BIGINT,
  offer_conversion_rate NUMERIC, joining_conversion_rate NUMERIC
) AS $$
DECLARE
  v_candidates_added BIGINT; v_candidates_joined BIGINT; v_submissions_made BIGINT;
  v_interviews_scheduled BIGINT; v_interviews_cleared BIGINT;
  v_offers_released BIGINT; v_offers_accepted BIGINT;
BEGIN
  IF NOT (is_leadership() OR p_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT count(*) INTO v_candidates_added FROM candidates WHERE created_by = p_user_id;
  SELECT count(*) INTO v_submissions_made FROM submissions WHERE submitted_by = p_user_id;
  SELECT count(*) INTO v_candidates_joined FROM submissions WHERE submitted_by = p_user_id AND status = 'joined';
  SELECT count(*) INTO v_interviews_scheduled FROM interviews WHERE created_by = p_user_id;
  SELECT count(*) INTO v_interviews_cleared FROM interviews WHERE created_by = p_user_id AND result = 'cleared';
  SELECT count(*) INTO v_offers_released FROM offers WHERE created_by = p_user_id;
  SELECT count(*) INTO v_offers_accepted FROM offers WHERE created_by = p_user_id AND status IN ('accepted', 'joined');

  RETURN QUERY SELECT
    v_candidates_added, v_candidates_joined, v_submissions_made,
    v_interviews_scheduled, v_interviews_cleared, v_offers_released, v_offers_accepted,
    ROUND(CASE WHEN v_offers_released = 0 THEN 0 ELSE (v_offers_accepted::NUMERIC / v_offers_released) * 100 END, 1),
    ROUND(CASE WHEN v_submissions_made = 0 THEN 0 ELSE (v_candidates_joined::NUMERIC / v_submissions_made) * 100 END, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_recruiter_workload(p_user_id UUID)
RETURNS TABLE (
  active_requirements BIGINT, active_candidates BIGINT, open_interviews BIGINT,
  pending_offers BIGINT, pending_followups BIGINT, pending_actions BIGINT
) AS $$
DECLARE
  v_active_requirements BIGINT; v_active_candidates BIGINT; v_open_interviews BIGINT;
  v_pending_offers BIGINT; v_pending_followups BIGINT;
BEGIN
  IF NOT (is_leadership() OR p_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT count(DISTINCT s.requirement_id) INTO v_active_requirements
  FROM submissions s JOIN requirements r ON r.id = s.requirement_id
  WHERE s.submitted_by = p_user_id AND r.status = 'open';

  SELECT count(*) INTO v_active_candidates FROM candidates WHERE created_by = p_user_id;
  SELECT count(*) INTO v_open_interviews FROM interviews WHERE created_by = p_user_id AND result = 'pending';
  SELECT count(*) INTO v_pending_offers FROM offers WHERE created_by = p_user_id AND status = 'offered';
  SELECT count(*) INTO v_pending_followups FROM submissions
    WHERE submitted_by = p_user_id AND status NOT IN ('joined', 'rejected')
      AND updated_at < NOW() - INTERVAL '2 days';

  RETURN QUERY SELECT
    v_active_requirements, v_active_candidates, v_open_interviews, v_pending_offers,
    v_pending_followups, (v_open_interviews + v_pending_offers + v_pending_followups);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- get_recruiter_leaderboard already used is_approved_user() — already
-- inclusive of business_head, no change needed.

-- ============================================================
-- 6. GRANTS — is_leadership() follows the same authenticated-only grant
-- pattern as the other helper functions.
-- ============================================================
REVOKE ALL ON FUNCTION is_leadership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_leadership() TO authenticated;
