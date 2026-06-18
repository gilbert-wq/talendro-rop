# Remediation Notes — Talendro ROP

This package is the remediated codebase following the
`TALENDRO ROP PRODUCTION READINESS AUDIT REPORT`. Every CRITICAL and HIGH
finding from that report has been fixed directly in the source and SQL
migrations. This file summarizes what changed and what you need to do when
deploying it.

## Required action before deploying

1. **Run the SQL.** If this is a brand-new Supabase project, run
   `supabase/migrations/001_complete_schema.sql` as-is — it already includes
   every fix. If you previously deployed the *original* (pre-remediation)
   version of this schema to a live Supabase project, run
   `supabase/migrations/002_security_and_vendor_patch.sql` afterward — it
   applies the same fixes idempotently without re-running the whole schema.
2. **Storage buckets are now private.** `resumes`, `jd-files`, and
   `candidate-documents` were public; they are now private. The app code
   already generates short-lived signed URLs on demand instead of permanent
   public links — no action needed there. But if any *existing* rows store a
   full `https://...supabase.co/storage/v1/object/public/...` URL from before
   this fix, that link will now 404 (the file itself is untouched — only the
   public path stopped resolving). Existing `candidate_documents.delete()`
   handles both old-style URLs and new-style paths, but candidates/requirements
   created before this patch should have their resume/JD re-uploaded once if
   you want a working signed link for them.
3. **Copy `.env.example` to `.env.local`** and fill in your Supabase project
   URL and anon key.
4. **Re-run `npm install`** — `papaparse` was added as a new dependency.

## Critical fixes

- **Privilege escalation (profiles RLS):** the `profiles` UPDATE policy was
  missing a `WITH CHECK` clause, so any signed-up user — including one still
  `pending` — could set their own `role` to `admin` and `status` to
  `approved` directly via the Supabase client, bypassing the entire approval
  workflow. Fixed by splitting into `profiles_update_admin` (admins can
  change anything) and `profiles_update_self` (a user can edit their own
  profile, but `role`/`status` must match what's already stored).
- **Privilege escalation (signup metadata):** found while fixing the above —
  `handle_new_user()` also trusted `raw_user_meta_data->>'role'` from the
  signup call itself, so `supabase.auth.signUp({ options: { data: { role:
  'admin' } } })` produced an instant, auto-approved admin account with no
  further exploit needed. New signups are now unconditionally created as
  `recruiter` / `pending`.
- **Public storage buckets:** `resumes`, `jd-files`, and
  `candidate-documents` were `public: true`, so candidate resumes, ID
  documents, and offer letters (with CTC) were fetchable by anyone with the
  URL, no login required — the storage RLS policies never actually applied to
  those reads. Buckets are now private; the app reads files via
  `createSignedUrl()` (1-hour expiry) instead of permanent public URLs.
- **Broken signup flow:** `useAuth.signUp` manually inserted a `profiles` row
  in addition to the `handle_new_user()` DB trigger that already does this
  automatically, guaranteeing a primary-key conflict — and a confusing error
  shown to the user — on every single signup. The redundant insert was
  removed; `full_name` is now passed through `signUp({ options: { data } })`.

## High-priority fixes

- **Service-role API called from the browser:** `UsersPage.tsx` called
  `supabase.auth.admin.generateLink(...)`, which requires the service-role
  key and can never actually succeed from a browser anon-key client. Removed
  in favor of the client-safe `resetPasswordForEmail`.
- **`notifications_insert` policy allowed writing to anyone's inbox:**
  `WITH CHECK (true)` is now `WITH CHECK (user_id = auth.uid() OR is_admin())`.
- **Vendor flow wasn't real:** `submissions` had no foreign key to `vendors`,
  only a free-text `partner_name`. Added `submissions.vendor_id` (FK), wired
  a vendor picker into the submission form, added a "Vendor Performance"
  report tab, and included vendor in submission/tracker exports.
- **Unbounded queries:** every list page fetched the entire table with no
  cap. Added `.limit(2000)` safeguards across `services.ts` as an interim
  measure (true server-side pagination via `.range()` is still recommended as
  a follow-up once data volume grows past that).
- **PostgREST filter injection:** unescaped user input was interpolated
  directly into `.or()` filter strings in three places (candidate search,
  candidate duplicate-check, bulk-upload duplicate-check). All now pass
  through `escapeFilterValue()`.
- **Missing `.gitignore` / `.env.example`:** both added. Previously there was
  no `.gitignore` at all, risking `node_modules`, `dist`, and any local
  `.env.local` (with real Supabase keys) being committed to git history.
- **Missing reset-password page:** `ForgotPasswordPage` already emailed a
  link to `/reset-password`, but no such route or page existed. Added
  `ResetPasswordPage.tsx` and wired the route.
- **DB-level data integrity:** added `CHECK` constraints for PAN format and
  non-negative CTC/notice-period so direct API calls can't bypass the
  client-side Zod validation.

## Medium-priority fixes also included

- ESLint config added (`npm run lint` previously failed outright — no config
  file existed despite the script and plugins being declared).
- `Database` type in `lib/supabase.ts` completed (was missing 6 of 16
  tables: `candidate_documents`, `candidate_notes`, `candidate_stage_history`,
  `teams`, `team_members`, `targets`), plus the new `vendor_id` field.
- Replaced the hand-rolled CSV parser in `BulkUploadPage.tsx` (broke on any
  value containing a comma) with PapaParse.
- Fixed an empty `vendor-xlsx` build chunk and a dynamic/static import
  conflict warning in `vite.config.ts` / `lib/utils.ts`.
- Added a pluggable error-reporting hook to `ErrorBoundary` so production
  crashes aren't only visible via `console.error` (wire in Sentry or
  equivalent via `setErrorReporter()` when ready).
- Added `aria-label` alongside `title` on icon-only action buttons in
  `UsersPage.tsx`.

## Not addressed in this pass (recommended follow-up)

- True server-side pagination (`.range()`-based) for list views, rather than
  the interim `.limit(2000)` caps.
- Migrating several pages (`UsersPage.tsx`, `BulkUploadPage.tsx`,
  `SubmissionsPage.tsx`, etc.) to go through `lib/services.ts` consistently
  instead of calling `supabase` directly — a code-organization improvement,
  not a correctness issue.
- Automated tests (none exist yet in this repo).
- CI pipeline (no GitHub Actions config exists yet).
- Wiring `createClient<Database>(...)` with the now-complete `Database` type
  — intentionally deferred because it requires updating every
  relationship-select string in `services.ts` to match supabase-js's typed
  join inference, which is a larger refactor than this pass's scope.

## Verification performed

`npm install`, `npx tsc --noEmit`, and `npm run build` were all run against
this exact codebase and passed cleanly (see the chat response for full
output). Because this is a static code package with no live Supabase
project attached, the workflow fixes above were verified by tracing each
code path end-to-end (signup → trigger → RLS → UI) rather than by exercising
a running deployment — run the SQL migration against a real Supabase project
and click through signup/login/candidate/submission/vendor/interview/offer/
reports once before going live, as you would with any release.
