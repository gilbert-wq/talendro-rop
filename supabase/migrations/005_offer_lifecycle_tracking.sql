-- ============================================================
-- TALENDRO ROP — OFFER/JOINING LIFECYCLE TRACKING
--
-- Adds:
--   1. offers.joined_date — the ACTUAL date someone joined, distinct from
--      the existing offers.joining_date which is the TENTATIVE/planned date
--      set at offer time (these can legitimately differ — a candidate's
--      real joining date often slips from what was first planned).
--   2. 'backed_out' / 'absconded' offer statuses, so a recruiter can record
--      that a candidate accepted an offer and then never joined or stopped
--      responding — previously there was no way to record this outcome at
--      all, only 'declined' (which means something different: declining
--      the offer itself, not disappearing after accepting it).
--   3. A trigger that auto-creates an offers row the moment a submission's
--      status flips to 'offered' (or, as a safety net, 'joined' without
--      ever having passed through 'offered') — so moving a candidate to
--      Offered on ANY Kanban board (global, or the new per-requirement
--      pipeline) always shows up in Offers & Joinings without anyone
--      having to remember to also create an offer record by hand there.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE offers ADD COLUMN IF NOT EXISTS joined_date DATE;

ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_status_check;
ALTER TABLE offers ADD CONSTRAINT offers_status_check
  CHECK (status IN ('offered', 'accepted', 'declined', 'joined', 'no_show', 'deferred', 'backed_out', 'absconded'));

CREATE INDEX IF NOT EXISTS idx_offers_joining_date ON offers(joining_date);
CREATE INDEX IF NOT EXISTS idx_offers_status_joining ON offers(status, joining_date);

-- Auto-create (or update) the offers row whenever a submission reaches
-- 'offered' or 'joined'. SECURITY DEFINER so this system-driven bookkeeping
-- insert always succeeds regardless of who dragged the Kanban card —
-- there's no injection surface since every value inserted is taken
-- directly from the NEW submissions row being updated, nothing
-- caller-supplied.
CREATE OR REPLACE FUNCTION auto_create_offer_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'offered' AND OLD.status IS DISTINCT FROM 'offered' THEN
    INSERT INTO offers (submission_id, candidate_id, requirement_id, offer_date, status, created_by)
    SELECT NEW.id, NEW.candidate_id, NEW.requirement_id, CURRENT_DATE, 'offered', NEW.submitted_by
    WHERE NOT EXISTS (SELECT 1 FROM offers WHERE submission_id = NEW.id);
  END IF;

  IF NEW.status = 'joined' AND OLD.status IS DISTINCT FROM 'joined' THEN
    UPDATE offers SET status = 'joined', joined_date = COALESCE(joined_date, CURRENT_DATE)
    WHERE submission_id = NEW.id;

    -- Safety net: a submission can jump straight to 'joined' without ever
    -- passing through 'offered' (e.g. a recruiter correcting a pipeline
    -- stage in bulk) — make sure it still gets an offers row.
    INSERT INTO offers (submission_id, candidate_id, requirement_id, offer_date, joined_date, status, created_by)
    SELECT NEW.id, NEW.candidate_id, NEW.requirement_id, CURRENT_DATE, CURRENT_DATE, 'joined', NEW.submitted_by
    WHERE NOT EXISTS (SELECT 1 FROM offers WHERE submission_id = NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_create_offer ON submissions;
CREATE TRIGGER trg_auto_create_offer
AFTER UPDATE OF status ON submissions
FOR EACH ROW EXECUTE FUNCTION auto_create_offer_on_status_change();
