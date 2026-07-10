-- ============================================================
-- TALENDRO ROP — REMOVE VENDOR MODULE
--
-- Talendro is an RPO (Recruitment Process Outsourcing) platform, not a
-- vendor/staffing-partner marketplace. The vendor module (added, then
-- locked down to leadership-only in 007) is being removed entirely per
-- product direction. Submissions keep their existing free-text
-- `partner_name` column for the rare case of a non-Talendro sourcing
-- partner, but the formal `vendors` table, its FK, and all vendor-only
-- RLS policies are dropped.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. Drop the FK from submissions -> vendors (keep partner_name as-is)
ALTER TABLE submissions DROP COLUMN IF EXISTS vendor_id;

-- 2. Drop vendor RLS policies (table drop below would cascade these too,
--    but dropping explicitly keeps this migration readable/idempotent).
DROP POLICY IF EXISTS "vendors_select" ON vendors;
DROP POLICY IF EXISTS "vendors_insert" ON vendors;
DROP POLICY IF EXISTS "vendors_update" ON vendors;
DROP POLICY IF EXISTS "vendors_delete" ON vendors;

-- 3. Drop the vendors table itself.
DROP TABLE IF EXISTS vendors;

-- Note: is_leadership() (used by clients, requirements-adjacent, and
-- recruiter-overview access) is untouched — it never depended on vendors.
