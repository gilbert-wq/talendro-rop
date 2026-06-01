# Talendro ROP — Recruitment Operations Platform

**Recruit. Track. Submit. Hire.**

A production-ready enterprise Recruitment Operations Platform built with React, TypeScript, Vite, TailwindCSS, and Supabase.

---

## Quick Start

### 1. Clone / Download the project

```bash
cd talendro-rop
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → Your Project → SQL Editor
2. Copy the entire contents of `supabase/migrations/001_complete_schema.sql`
3. Paste and run in SQL Editor
4. Wait for completion (creates all tables, indexes, triggers, RLS policies, storage buckets)

### 5. Create your first Admin user

In Supabase Dashboard → Authentication → Users → Add User:
- Enter your email and password
- Click "Create User"

Then in SQL Editor run:
```sql
UPDATE profiles 
SET role = 'admin', status = 'approved' 
WHERE email = 'your-admin@email.com';
```

### 6. Run locally

```bash
npm run dev
```

Visit `http://localhost:5173`

### 7. Build for production

```bash
npm run build
```

---

## Deploy to Vercel

### Option A: Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow prompts. Add environment variables when asked.

### Option B: Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your project folder
3. Framework Preset: **Vite**
4. Add Environment Variables:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click Deploy

---

## Features

### Modules
| Module | Description |
|--------|-------------|
| Dashboard | KPI cards, charts, recent activity |
| Clients | Client CRM with full CRUD |
| Vendors | Vendor management |
| Requirements | Job requirements with JD upload |
| Candidates | Full candidate profiles, resume upload |
| Submissions | Core submission tracker (like staffing ATS) |
| Kanban | Drag-and-drop pipeline board |
| Interviews | Schedule, reschedule, feedback tracking |
| Offers | Offer lifecycle management |
| Reports | Analytics with Excel/CSV/PDF export |
| Bulk Upload | Mass import via CSV |
| Notifications | Realtime notification center |
| Teams | Team creation and member management |
| KPI Targets | Recruiter target setting and tracking |
| Activity Logs | Complete audit trail |
| User Management | Admin approval workflow |
| Settings | Profile, security, preferences |

### User Roles
- **Admin**: Full access — approve users, manage teams, view all logs
- **Recruiter**: Core recruitment operations — add candidates, submit, track

### Storage Buckets (auto-created by migration)
- `resumes` — candidate resumes (PDF/DOCX)
- `jd-files` — job description attachments
- `candidate-documents` — additional documents per candidate
- `company-assets` — brand assets

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | TailwindCSS, Radix UI primitives |
| State | TanStack Query (React Query) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Excel | SheetJS (xlsx) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Deployment | Vercel |

---

## Project Structure

```
talendro-rop/
├── public/
│   ├── talendro-logo.svg
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── ui/              # Reusable UI primitives
│   │   ├── layout/          # Sidebar, Header, AppLayout
│   │   ├── auth/            # Login, Signup, etc.
│   │   ├── dashboard/       # Dashboard page
│   │   ├── clients/         # Client management
│   │   ├── vendors/         # Vendor management
│   │   ├── requirements/    # Job requirements
│   │   ├── candidates/      # Candidate profiles + timeline
│   │   ├── submissions/     # Submission tracker
│   │   ├── kanban/          # Pipeline board
│   │   ├── interviews/      # Interview management
│   │   ├── offers/          # Offer & joining management
│   │   ├── reports/         # Analytics & reports
│   │   ├── bulk/            # Bulk import center
│   │   ├── notifications/   # Notification center
│   │   └── activity/        # Logs, Users, Teams, Targets, Settings
│   ├── hooks/               # useAuth, useQueries, useToast, useRealtime
│   ├── lib/                 # supabase, services, utils, exports, validations
│   └── types/               # TypeScript type definitions
├── supabase/
│   └── migrations/
│       └── 001_complete_schema.sql
├── .env.example
├── vercel.json
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

---

## Supabase Setup Checklist

- [ ] Run `001_complete_schema.sql` in SQL Editor
- [ ] Create admin user via Auth → Users → Add User
- [ ] Run `UPDATE profiles SET role='admin', status='approved' WHERE email='...'`
- [ ] Verify storage buckets exist: resumes, jd-files, candidate-documents, company-assets
- [ ] Test login at your deployed URL

---

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes |

Both found in: Supabase Dashboard → Settings → API

---

## Support

Talendro ROP is built by Talendro Solutions.
