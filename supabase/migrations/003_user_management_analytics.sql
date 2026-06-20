-- ============================================================
-- TALENDRO ROP — MIGRATION 003
-- User Management, Profile Completion, Login Tracking,
-- Attendance Analytics, Live Activity Monitoring, Recruiter Insights
-- ============================================================
-- Run this AFTER 001_complete_schema.sql (and 002, if you applied it).
-- Idempotent: safe to run multiple times.
--
-- DESIGN NOTES (read before extending):
--   - "Phone" and "Profile Photo" from the feature spec map onto the
--     EXISTING profiles.phone / profiles.avatar_url columns rather than
--     duplicating them under new names.
--   - activity_logs already exists (001) with (module, action, details,
--     record_id). Rather than creating a second, parallel table, this
--     migration adds an `activity_type` column to it for categorized
--     filtering; module/details/record_id serve as module_name/
--     activity_description/reference_id from the feature spec.
--   - "Online" status is reconciled via a 15-minute heartbeat: the app
--     updates user_login_sessions.updated_at every ~60s while a tab is
--     open, and get_online_users() treats any active session whose
--     updated_at is older than 15 minutes as stale and auto-closes it.
--     This is what actually implements "browser close" / "session
--     expiry" handling — there is no reliable cross-browser signal for an
--     abrupt tab close, so staleness reconciliation is the honest
--     mechanism (the app also makes a best-effort immediate logout call
--     on beforeunload/pagehide, see useLoginSessionTracking.ts).
-- ============================================================

-- ============================================================
-- 1. PROFILE ENHANCEMENTS
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS alternate_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_joining DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reporting_manager UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permanent_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS education TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experience_years NUMERIC(4, 1) CHECK (experience_years IS NULL OR experience_years >= 0);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER NOT NULL DEFAULT 0 CHECK (profile_completion_percentage BETWEEN 0 AND 100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE;
-- Denormalized for fast access from list views (Recruiter Profile Card,
-- attendance report) without a correlated subquery against
-- user_login_sessions per row; kept in sync by trg_update_last_login below.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department);
CREATE INDEX IF NOT EXISTS idx_profiles_reporting_manager ON profiles(reporting_manager);
CREATE INDEX IF NOT EXISTS idx_profiles_completed ON profiles(profile_completed);
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON profiles(employee_id);

-- ============================================================
-- 2. PROFILE COMPLETION % — calculated automatically, never client-supplied
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_profile_completion()
RETURNS TRIGGER AS $$
DECLARE
  completed_items INT := 0;
  total_items INT := 8;
BEGIN
  IF NEW.full_name IS NOT NULL AND length(trim(NEW.full_name)) > 0 THEN completed_items := completed_items + 1; END IF;
  IF NEW.phone IS NOT NULL AND length(trim(NEW.phone)) > 0 THEN completed_items := completed_items + 1; END IF;
  IF NEW.date_of_joining IS NOT NULL THEN completed_items := completed_items + 1; END IF;
  IF NEW.department IS NOT NULL AND length(trim(NEW.department)) > 0 THEN completed_items := completed_items + 1; END IF;
  IF NEW.designation IS NOT NULL AND length(trim(NEW.designation)) > 0 THEN completed_items := completed_items + 1; END IF;
  IF NEW.emergency_contact_name IS NOT NULL AND length(trim(NEW.emergency_contact_name)) > 0
     AND NEW.emergency_contact_number IS NOT NULL AND length(trim(NEW.emergency_contact_number)) > 0 THEN
    completed_items := completed_items + 1;
  END IF;
  IF NEW.current_address IS NOT NULL AND length(trim(NEW.current_address)) > 0 THEN completed_items := completed_items + 1; END IF;
  IF NEW.avatar_url IS NOT NULL AND length(trim(NEW.avatar_url)) > 0 THEN completed_items := completed_items + 1; END IF;

  NEW.profile_completion_percentage := ROUND((completed_items::NUMERIC / total_items) * 100);
  NEW.profile_completed := (completed_items = total_items);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_completion ON profiles;
CREATE TRIGGER trg_profiles_completion
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION calculate_profile_completion();

-- ============================================================
-- 3. USER LOGIN SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_login_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_time TIMESTAMPTZ,
  session_duration_minutes INTEGER,
  ip_address TEXT,
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  browser_name TEXT,
  operating_system TEXT,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_sessions_user ON user_login_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_active ON user_login_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_login_sessions_login_time ON user_login_sessions(login_time DESC);
CREATE INDEX IF NOT EXISTS idx_login_sessions_user_logintime ON user_login_sessions(user_id, login_time DESC);

DROP TRIGGER IF EXISTS trg_user_login_sessions_updated_at ON user_login_sessions;
CREATE TRIGGER trg_user_login_sessions_updated_at
BEFORE UPDATE ON user_login_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-calculate session duration the moment logout_time is first set,
-- whether that happens via an explicit logout call or the staleness
-- reconciliation inside get_online_users().
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.logout_time IS NOT NULL AND OLD.logout_time IS NULL THEN
    NEW.session_duration_minutes := CEIL(EXTRACT(EPOCH FROM (NEW.logout_time - NEW.login_time)) / 60);
    NEW.is_active := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_session_duration ON user_login_sessions;
CREATE TRIGGER trg_session_duration
BEFORE UPDATE ON user_login_sessions
FOR EACH ROW EXECUTE FUNCTION calculate_session_duration();

-- Keep profiles.last_login_at in sync whenever a new session is created.
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles SET last_login_at = NEW.login_time WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_last_login ON user_login_sessions;
CREATE TRIGGER trg_update_last_login
AFTER INSERT ON user_login_sessions
FOR EACH ROW EXECUTE FUNCTION update_last_login();

ALTER TABLE user_login_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_sessions_select" ON user_login_sessions;
CREATE POLICY "login_sessions_select" ON user_login_sessions
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "login_sessions_insert" ON user_login_sessions;
CREATE POLICY "login_sessions_insert" ON user_login_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "login_sessions_update" ON user_login_sessions;
CREATE POLICY "login_sessions_update" ON user_login_sessions
  FOR UPDATE USING (user_id = auth.uid() OR is_admin());

-- ============================================================
-- 4. ACTIVITY LOGS ENHANCEMENTS
-- ============================================================
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS activity_type TEXT;
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);

-- ============================================================
-- 5. RPC FUNCTIONS
-- SECURITY: every SECURITY DEFINER function below performs its OWN
-- explicit is_admin()/is_approved_user()/self-id authorization check
-- before touching data. SECURITY DEFINER runs with the function owner's
-- privileges and bypasses RLS entirely — skipping this check is exactly
-- the privilege-escalation bug class already fixed elsewhere in this
-- project (see migration 002), so it is treated with the same care here.
-- ============================================================

-- get_online_users(): admin-only. Also lazily reconciles stale sessions
-- (no heartbeat in 15+ minutes) as offline — see design notes above.
CREATE OR REPLACE FUNCTION get_online_users()
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  role TEXT,
  login_time TIMESTAMPTZ,
  online_minutes INTEGER
) AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  UPDATE user_login_sessions
  SET logout_time = updated_at
  WHERE is_active = TRUE AND updated_at < NOW() - INTERVAL '15 minutes';

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.role,
    s.login_time,
    CEIL(EXTRACT(EPOCH FROM (NOW() - s.login_time)) / 60)::INTEGER
  FROM user_login_sessions s
  JOIN profiles p ON p.id = s.user_id
  WHERE s.is_active = TRUE
  ORDER BY s.login_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_recruiter_profile_summary(): admin or self.
CREATE OR REPLACE FUNCTION get_recruiter_profile_summary(p_user_id UUID)
RETURNS TABLE (
  id UUID, full_name TEXT, employee_id TEXT, email TEXT, phone TEXT,
  alternate_phone TEXT, department TEXT, designation TEXT,
  reporting_manager_name TEXT, date_of_joining DATE, date_of_birth DATE,
  gender TEXT, current_address TEXT, permanent_address TEXT,
  emergency_contact_name TEXT, emergency_contact_number TEXT,
  education TEXT, experience_years NUMERIC, avatar_url TEXT, status TEXT,
  last_login_at TIMESTAMPTZ, created_at TIMESTAMPTZ,
  profile_completion_percentage INTEGER
) AS $$
BEGIN
  IF NOT (is_admin() OR p_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.full_name, p.employee_id, p.email, p.phone, p.alternate_phone,
    p.department, p.designation, mgr.full_name, p.date_of_joining,
    p.date_of_birth, p.gender, p.current_address, p.permanent_address,
    p.emergency_contact_name, p.emergency_contact_number, p.education,
    p.experience_years, p.avatar_url, p.status, p.last_login_at,
    p.created_at, p.profile_completion_percentage
  FROM profiles p
  LEFT JOIN profiles mgr ON mgr.id = p.reporting_manager
  WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- get_recruiter_performance(): admin or self.
CREATE OR REPLACE FUNCTION get_recruiter_performance(p_user_id UUID)
RETURNS TABLE (
  candidates_added BIGINT,
  candidates_joined BIGINT,
  submissions_made BIGINT,
  interviews_scheduled BIGINT,
  interviews_cleared BIGINT,
  offers_released BIGINT,
  offers_accepted BIGINT,
  offer_conversion_rate NUMERIC,
  joining_conversion_rate NUMERIC
) AS $$
DECLARE
  v_candidates_added BIGINT;
  v_candidates_joined BIGINT;
  v_submissions BIGINT;
  v_interviews_scheduled BIGINT;
  v_interviews_cleared BIGINT;
  v_offers_released BIGINT;
  v_offers_accepted BIGINT;
BEGIN
  IF NOT (is_admin() OR p_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(*) INTO v_candidates_added FROM candidates WHERE created_by = p_user_id;
  SELECT COUNT(*) INTO v_candidates_joined FROM submissions WHERE submitted_by = p_user_id AND status = 'joined';
  SELECT COUNT(*) INTO v_submissions FROM submissions WHERE submitted_by = p_user_id;
  SELECT COUNT(*) INTO v_interviews_scheduled FROM interviews WHERE created_by = p_user_id;
  SELECT COUNT(*) INTO v_interviews_cleared FROM interviews WHERE created_by = p_user_id AND result = 'cleared';
  SELECT COUNT(*) INTO v_offers_released FROM offers WHERE created_by = p_user_id;
  SELECT COUNT(*) INTO v_offers_accepted FROM offers WHERE created_by = p_user_id AND status IN ('accepted', 'joined');

  RETURN QUERY SELECT
    v_candidates_added, v_candidates_joined, v_submissions,
    v_interviews_scheduled, v_interviews_cleared, v_offers_released, v_offers_accepted,
    CASE WHEN v_offers_released = 0 THEN 0 ELSE ROUND((v_offers_accepted::NUMERIC / v_offers_released) * 100, 1) END,
    CASE WHEN v_submissions = 0 THEN 0 ELSE ROUND((v_candidates_joined::NUMERIC / v_submissions) * 100, 1) END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- get_recruiter_workload(): admin or self.
CREATE OR REPLACE FUNCTION get_recruiter_workload(p_user_id UUID)
RETURNS TABLE (
  active_requirements BIGINT,
  active_candidates BIGINT,
  open_interviews BIGINT,
  pending_offers BIGINT,
  pending_followups BIGINT,
  pending_actions BIGINT
) AS $$
DECLARE
  v_active_requirements BIGINT;
  v_active_candidates BIGINT;
  v_open_interviews BIGINT;
  v_pending_offers BIGINT;
  v_pending_followups BIGINT;
BEGIN
  IF NOT (is_admin() OR p_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(DISTINCT s.requirement_id) INTO v_active_requirements
  FROM submissions s JOIN requirements r ON r.id = s.requirement_id
  WHERE s.submitted_by = p_user_id AND r.status = 'open';

  SELECT COUNT(*) INTO v_active_candidates
  FROM submissions WHERE submitted_by = p_user_id AND status NOT IN ('joined', 'rejected');

  SELECT COUNT(*) INTO v_open_interviews
  FROM interviews WHERE created_by = p_user_id AND result = 'pending';

  SELECT COUNT(*) INTO v_pending_offers
  FROM offers WHERE created_by = p_user_id AND status = 'offered';

  -- "Pending follow-ups": in-flight submissions with no status change in
  -- the last 3 days — a recruiter-actionable backlog signal (this exact
  -- definition isn't specified by the feature request, so it's documented
  -- here as a judgment call rather than left silently implicit).
  SELECT COUNT(*) INTO v_pending_followups
  FROM submissions
  WHERE submitted_by = p_user_id AND status NOT IN ('joined', 'rejected')
    AND updated_at < NOW() - INTERVAL '3 days';

  RETURN QUERY SELECT
    v_active_requirements, v_active_candidates, v_open_interviews,
    v_pending_offers, v_pending_followups,
    (v_open_interviews + v_pending_offers + v_pending_followups);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- get_user_attendance_report(): admin-only. One row per user per day.
CREATE OR REPLACE FUNCTION get_user_attendance_report(p_start DATE, p_end DATE)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  employee_id TEXT,
  role TEXT,
  department TEXT,
  attendance_date DATE,
  first_login TIMESTAMPTZ,
  last_logout TIMESTAMPTZ,
  total_duration_minutes BIGINT,
  status TEXT
) AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.employee_id,
    p.role,
    p.department,
    (s.login_time AT TIME ZONE 'UTC')::DATE AS attendance_date,
    MIN(s.login_time) AS first_login,
    MAX(s.logout_time) AS last_logout,
    SUM(
      COALESCE(s.session_duration_minutes,
        CASE WHEN s.is_active THEN CEIL(EXTRACT(EPOCH FROM (NOW() - s.login_time)) / 60) ELSE 0 END)
    )::BIGINT AS total_duration_minutes,
    CASE WHEN BOOL_OR(s.is_active AND s.updated_at > NOW() - INTERVAL '15 minutes')
      THEN 'online' ELSE 'offline' END AS status
  FROM user_login_sessions s
  JOIN profiles p ON p.id = s.user_id
  WHERE (s.login_time AT TIME ZONE 'UTC')::DATE BETWEEN p_start AND p_end
  GROUP BY p.id, p.full_name, p.employee_id, p.role, p.department, (s.login_time AT TIME ZONE 'UTC')::DATE
  ORDER BY attendance_date DESC, p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- get_recruiter_leaderboard(): any approved user (recruiters can see the
-- board they're competing on; only attendance/login-sessions/activity-logs
-- are explicitly admin-only per the feature spec).
CREATE OR REPLACE FUNCTION get_recruiter_leaderboard(p_limit INT DEFAULT 10)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  full_name TEXT,
  score NUMERIC,
  candidates_added BIGINT,
  submissions_made BIGINT,
  interviews_cleared BIGINT,
  offers_accepted BIGINT,
  joins BIGINT,
  is_top_performer BOOLEAN
) AS $$
BEGIN
  IF NOT is_approved_user() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT
      p.id AS user_id,
      p.full_name,
      COUNT(DISTINCT c.id) AS candidates_added,
      COUNT(DISTINCT s.id) AS submissions_made,
      COUNT(DISTINCT i.id) FILTER (WHERE i.result = 'cleared') AS interviews_cleared,
      COUNT(DISTINCT o.id) FILTER (WHERE o.status IN ('accepted', 'joined')) AS offers_accepted,
      COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'joined') AS joins,
      CASE WHEN COUNT(DISTINCT o.id) = 0 THEN 0
        ELSE COUNT(DISTINCT o.id) FILTER (WHERE o.status IN ('accepted', 'joined'))::NUMERIC / COUNT(DISTINCT o.id) END AS offer_conversion,
      CASE WHEN COUNT(DISTINCT s.id) = 0 THEN 0
        ELSE COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'joined')::NUMERIC / COUNT(DISTINCT s.id) END AS submission_ratio
    FROM profiles p
    LEFT JOIN candidates c ON c.created_by = p.id
    LEFT JOIN submissions s ON s.submitted_by = p.id
    LEFT JOIN interviews i ON i.created_by = p.id
    LEFT JOIN offers o ON o.created_by = p.id
    WHERE p.role = 'recruiter' AND p.status = 'approved'
    GROUP BY p.id, p.full_name
  ),
  scored AS (
    SELECT agg.*,
      (candidates_added * 1 + submissions_made * 2 + interviews_cleared * 3 + offers_accepted * 5 + joins * 8)::NUMERIC AS calc_score,
      MAX(joins) OVER () AS max_joins,
      MAX(offer_conversion) OVER () AS max_offer_conversion,
      MAX(submission_ratio) OVER () AS max_submission_ratio
    FROM agg
  )
  SELECT
    RANK() OVER (ORDER BY calc_score DESC),
    user_id, full_name, calc_score,
    candidates_added, submissions_made, interviews_cleared, offers_accepted, joins,
    (joins > 0 AND joins = max_joins)
      OR (offer_conversion > 0 AND offer_conversion = max_offer_conversion)
      OR (submission_ratio > 0 AND submission_ratio = max_submission_ratio)
  FROM scored
  ORDER BY calc_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- get_live_activity_feed(): SECURITY INVOKER (the default — no
-- SECURITY DEFINER) so the existing activity_logs RLS policy (own rows,
-- or all rows for admins) is enforced automatically per caller, with no
-- separate authorization check needed inside this function.
CREATE OR REPLACE FUNCTION get_live_activity_feed(p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID, user_id UUID, user_name TEXT, role TEXT, module_name TEXT,
  activity_type TEXT, activity_description TEXT, reference_id UUID, created_at TIMESTAMPTZ
) AS $$
  SELECT id, user_id, user_name, role, module AS module_name,
         COALESCE(activity_type, action) AS activity_type,
         COALESCE(details, action) AS activity_description,
         record_id AS reference_id, created_at
  FROM activity_logs
  ORDER BY created_at DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- 6. EXPLICIT GRANTS — defense in depth. Every function above already
-- self-checks is_admin()/is_approved_user()/self-id, so an anon caller
-- would already be rejected internally — this just denies it at the grant
-- layer too, so a caller without a valid session can't even invoke them.
-- ============================================================
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'get_online_users()',
    'get_recruiter_profile_summary(uuid)',
    'get_recruiter_performance(uuid)',
    'get_recruiter_workload(uuid)',
    'get_user_attendance_report(date, date)',
    'get_recruiter_leaderboard(int)',
    'get_live_activity_feed(int)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', fn);
  END LOOP;
END;
$$;
