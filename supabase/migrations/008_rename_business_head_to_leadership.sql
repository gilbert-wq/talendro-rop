-- ============================================================
-- TALENDRO ROP — RENAME business_head → leadership
--
-- Clarification from the business owner: "Leadership" is a permission
-- TIER, not a job title — a CEO, MD, Business Head, or VP might all hold
-- it, with their actual title captured by the existing free-text
-- `designation` field, not by the role value itself. 'business_head' as a
-- literal role name baked that one specific title into the system; this
-- renames it to the generic 'leadership' so the role value matches what it
-- actually represents (full Clients/Vendors/Requirements/recruiter-profile
-- access), while `designation` continues to carry "CEO", "Managing
-- Director", "Business Head", etc. for display.
--
-- Idempotent — safe to re-run, and safe to run whether or not
-- 007_business_head_role.sql has been applied yet (if it hasn't, the
-- UPDATE below simply matches zero rows).
-- ============================================================

UPDATE profiles SET role = 'leadership' WHERE role = 'business_head';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'recruiter', 'leadership'));

CREATE OR REPLACE FUNCTION is_leadership()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'leadership') AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
