import { supabase } from './supabase'
import { escapeFilterValue } from './utils'
import type {
  Profile, Client, Vendor, Requirement, Candidate,
  Submission, Interview, Offer, Team, TeamMember, Target,
  ActivityLog, Notification, CandidateDocument, CandidateNote,
  CandidateStageHistory, DashboardStats, RecruiterKPI
} from '@/types'

// ─── PROFILES ─────────────────────────────────────────────────────────────────
export const profilesService = {
  getAll: () =>
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),

  getById: (id: string) =>
    supabase.from('profiles').select('*').eq('id', id).single(),

  update: (id: string, data: Partial<Profile>) =>
    supabase.from('profiles').update(data).eq('id', id),

  updateStatus: (id: string, status: Profile['status']) =>
    supabase.from('profiles').update({ status }).eq('id', id),

  getApprovedRecruiters: () =>
    supabase.from('profiles').select('*').eq('status', 'approved').order('full_name'),
}

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
export const clientsService = {
  getAll: () =>
    supabase.from('clients').select('*').order('client_name').limit(2000),

  getActive: () =>
    supabase.from('clients').select('id, client_name').eq('status', 'active').order('client_name'),

  create: (data: Omit<Client, 'id' | 'created_at' | 'updated_at'>) =>
    supabase.from('clients').insert(data).select().single(),

  update: (id: string, data: Partial<Client>) =>
    supabase.from('clients').update(data).eq('id', id),

  delete: (id: string) =>
    supabase.from('clients').delete().eq('id', id),
}

// ─── VENDORS ─────────────────────────────────────────────────────────────────
export const vendorsService = {
  getAll: () =>
    supabase.from('vendors').select('*').order('vendor_name').limit(2000),

  getActive: () =>
    supabase.from('vendors').select('id, vendor_name').eq('status', 'active').order('vendor_name'),

  create: (data: Omit<Vendor, 'id' | 'created_at' | 'updated_at'>) =>
    supabase.from('vendors').insert(data).select().single(),

  update: (id: string, data: Partial<Vendor>) =>
    supabase.from('vendors').update(data).eq('id', id),

  delete: (id: string) =>
    supabase.from('vendors').delete().eq('id', id),
}

// ─── REQUIREMENTS ─────────────────────────────────────────────────────────────
export const requirementsService = {
  getAll: () =>
    supabase.from('requirements')
      .select('*, clients(client_name)')
      .order('created_at', { ascending: false })
      .limit(2000),

  getOpen: () =>
    supabase.from('requirements')
      .select('id, fg_id, requirement_title')
      .eq('status', 'open')
      .order('fg_id'),

  getById: (id: string) =>
    supabase.from('requirements')
      .select('*, clients(client_name)')
      .eq('id', id).single(),

  create: (data: Omit<Requirement, 'id' | 'created_at' | 'updated_at' | 'clients'>) =>
    supabase.from('requirements').insert(data).select().single(),

  update: (id: string, data: Partial<Requirement>) =>
    supabase.from('requirements').update(data).eq('id', id),

  delete: (id: string) =>
    supabase.from('requirements').delete().eq('id', id),

  checkFGIdExists: (fgId: string, excludeId?: string) =>
    supabase.from('requirements')
      .select('id')
      .eq('fg_id', fgId)
      .neq('id', excludeId ?? '00000000-0000-0000-0000-000000000000'),
}

// ─── CANDIDATES ─────────────────────────────────────────────────────────────────
export const candidatesService = {
  getAll: () =>
    // Capped to keep the initial fetch bounded as the candidate pool grows.
    // TODO: move to true server-side pagination (.range()) once list views
    // support page-by-page fetching instead of client-side-only paging.
    supabase.from('candidates').select('*').order('created_at', { ascending: false }).limit(2000),

  getById: (id: string) =>
    supabase.from('candidates').select('*').eq('id', id).single(),

  search: (query: string) => {
    const q = escapeFilterValue(query)
    return supabase.from('candidates')
      .select('id, candidate_name, mobile_number, email_address, current_location, total_experience, skills')
      .or(`candidate_name.ilike.%${q}%,mobile_number.ilike.%${q}%,email_address.ilike.%${q}%`)
  },

  checkDuplicate: (mobile: string, email: string, excludeId?: string) => {
    const m = escapeFilterValue(mobile)
    const e = escapeFilterValue(email)
    return supabase.from('candidates')
      .select('id, candidate_name')
      .or(`mobile_number.eq.${m},email_address.eq.${e}`)
      .neq('id', excludeId ?? '00000000-0000-0000-0000-000000000000')
  },

  create: (data: Omit<Candidate, 'id' | 'created_at' | 'updated_at'>) =>
    supabase.from('candidates').insert(data).select().single(),

  update: (id: string, data: Partial<Candidate>) =>
    supabase.from('candidates').update(data).eq('id', id),

  delete: (id: string) =>
    supabase.from('candidates').delete().eq('id', id),
}

// ─── CANDIDATE DOCUMENTS ─────────────────────────────────────────────────────
export const candidateDocumentsService = {
  getByCandidateId: (candidateId: string) =>
    supabase.from('candidate_documents')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false }),

  upload: async (candidateId: string, file: File, documentType: string, uploadedBy: string) => {
    const path = `${candidateId}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('candidate-documents')
      .upload(path, file)
    if (uploadError) return { data: null, error: uploadError }
    // Bucket is private — store the storage path, not a public URL.
    // A fresh signed URL is generated on demand via getSignedUrl().
    return supabase.from('candidate_documents').insert({
      candidate_id: candidateId,
      document_name: file.name,
      document_type: documentType,
      file_url: path,
      file_size: file.size,
      uploaded_by: uploadedBy,
    }).select().single()
  },

  getSignedUrl: async (path: string, expiresIn = 3600) => {
    const { data, error } = await supabase.storage.from('candidate-documents').createSignedUrl(path, expiresIn)
    return { url: data?.signedUrl ?? null, error }
  },

  delete: async (doc: CandidateDocument) => {
    // file_url now stores the raw storage path (private bucket); older rows
    // created before this fix may still hold a full public URL, so fall back
    // to extracting the path from it for backwards compatibility.
    const path = doc.file_url.includes('/candidate-documents/')
      ? doc.file_url.split('/candidate-documents/')[1]
      : doc.file_url
    await supabase.storage.from('candidate-documents').remove([path])
    return supabase.from('candidate_documents').delete().eq('id', doc.id)
  },
}

// ─── CANDIDATE NOTES ─────────────────────────────────────────────────────────
export const candidateNotesService = {
  getByCandidateId: (candidateId: string) =>
    supabase.from('candidate_notes')
      .select('*, profiles(full_name)')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false }),

  create: (candidateId: string, note: string, createdBy: string) =>
    supabase.from('candidate_notes').insert({ candidate_id: candidateId, note, created_by: createdBy }).select().single(),

  delete: (id: string) =>
    supabase.from('candidate_notes').delete().eq('id', id),
}

// ─── CANDIDATE STAGE HISTORY ─────────────────────────────────────────────────
export const stageHistoryService = {
  getBySubmissionId: (submissionId: string) =>
    supabase.from('candidate_stage_history')
      .select('*, profiles(full_name)')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: false }),

  getByCandidateId: (candidateId: string) =>
    supabase.from('candidate_stage_history')
      .select('*, profiles(full_name), submissions(requirement_id, requirements(fg_id, requirement_title))')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false }),
}

// ─── SUBMISSIONS ─────────────────────────────────────────────────────────────
export const submissionsService = {
  getAll: () =>
    supabase.from('submissions')
      .select('*, candidates(*), requirements(fg_id, requirement_title, clients(client_name)), profiles!submitted_by(full_name), vendors(vendor_name)')
      .order('submission_date', { ascending: false })
      .limit(2000),

  getById: (id: string) =>
    supabase.from('submissions')
      .select('*, candidates(*), requirements(fg_id, requirement_title, clients(client_name)), vendors(vendor_name)')
      .eq('id', id).single(),

  getByStatus: (status: string) =>
    supabase.from('submissions')
      .select('*, candidates(candidate_name, mobile_number, current_location, total_experience, expected_ctc, skills), requirements(fg_id, requirement_title), vendors(vendor_name)')
      .eq('status', status),

  getByVendor: (vendorId: string) =>
    supabase.from('submissions')
      .select('*, candidates(candidate_name), requirements(fg_id, requirement_title)')
      .eq('vendor_id', vendorId)
      .order('submission_date', { ascending: false }),

  checkDuplicate: (requirementId: string, candidateId: string) =>
    supabase.from('submissions')
      .select('id')
      .eq('requirement_id', requirementId)
      .eq('candidate_id', candidateId),

  create: (data: Omit<Submission, 'id' | 'created_at' | 'updated_at' | 'candidates' | 'requirements' | 'profiles' | 'vendors'>) =>
    supabase.from('submissions').insert(data).select().single(),

  update: (id: string, data: Partial<Submission>) =>
    supabase.from('submissions').update(data).eq('id', id),

  updateStatus: (id: string, status: string) =>
    supabase.from('submissions').update({ status }).eq('id', id),

  delete: (id: string) =>
    supabase.from('submissions').delete().eq('id', id),
}

// ─── INTERVIEWS ─────────────────────────────────────────────────────────────
export const interviewsService = {
  getAll: () =>
    supabase.from('interviews')
      .select('*, candidates(candidate_name, mobile_number), requirements(fg_id, requirement_title)')
      .order('interview_date', { ascending: false })
      .limit(2000),

  create: (data: Omit<Interview, 'id' | 'created_at' | 'updated_at' | 'candidates' | 'requirements'>) =>
    supabase.from('interviews').insert(data).select().single(),

  update: (id: string, data: Partial<Interview>) =>
    supabase.from('interviews').update(data).eq('id', id),

  delete: (id: string) =>
    supabase.from('interviews').delete().eq('id', id),
}

// ─── OFFERS ─────────────────────────────────────────────────────────────────
export const offersService = {
  getAll: () =>
    supabase.from('offers')
      .select('*, candidates(candidate_name, mobile_number, email_address), requirements(fg_id, requirement_title)')
      .order('created_at', { ascending: false })
      .limit(2000),

  create: (data: Omit<Offer, 'id' | 'created_at' | 'updated_at' | 'candidates' | 'requirements'>) =>
    supabase.from('offers').insert(data).select().single(),

  update: (id: string, data: Partial<Offer>) =>
    supabase.from('offers').update(data).eq('id', id),

  delete: (id: string) =>
    supabase.from('offers').delete().eq('id', id),
}

// ─── TEAMS ─────────────────────────────────────────────────────────────────
export const teamsService = {
  getAll: () =>
    supabase.from('teams')
      .select('*, profiles!manager_id(full_name)')
      .order('team_name'),

  getMembers: (teamId: string) =>
    supabase.from('team_members')
      .select('*, profiles(full_name, email, role)')
      .eq('team_id', teamId),

  create: (data: Omit<Team, 'id' | 'created_at' | 'updated_at' | 'profiles'>) =>
    supabase.from('teams').insert(data).select().single(),

  update: (id: string, data: Partial<Team>) =>
    supabase.from('teams').update(data).eq('id', id),

  delete: (id: string) =>
    supabase.from('teams').delete().eq('id', id),

  addMember: (teamId: string, userId: string, roleInTeam: string) =>
    supabase.from('team_members').insert({ team_id: teamId, user_id: userId, role_in_team: roleInTeam }),

  removeMember: (teamId: string, userId: string) =>
    supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId),
}

// ─── TARGETS ─────────────────────────────────────────────────────────────────
export const targetsService = {
  getAll: () =>
    supabase.from('targets')
      .select('*, profiles(full_name)')
      .order('period_start', { ascending: false }),

  getByUser: (userId: string) =>
    supabase.from('targets').select('*').eq('user_id', userId).order('period_start', { ascending: false }),

  create: (data: Omit<Target, 'id' | 'created_at' | 'updated_at' | 'actual_submissions' | 'actual_interviews' | 'actual_offers' | 'actual_joinings' | 'profiles'>) =>
    supabase.from('targets').insert(data).select().single(),

  update: (id: string, data: Partial<Target>) =>
    supabase.from('targets').update(data).eq('id', id),

  delete: (id: string) =>
    supabase.from('targets').delete().eq('id', id),
}

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────────
export const notificationsService = {
  getByUser: (userId: string) =>
    supabase.from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),

  getUnreadCount: (userId: string) =>
    supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false),

  markRead: (id: string) =>
    supabase.from('notifications').update({ read: true }).eq('id', id),

  markAllRead: (userId: string) =>
    supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false),

  create: (notification: Omit<Notification, 'id' | 'created_at'>) =>
    supabase.from('notifications').insert(notification),

  delete: (id: string) =>
    supabase.from('notifications').delete().eq('id', id),

  deleteAll: (userId: string) =>
    supabase.from('notifications').delete().eq('user_id', userId),
}

// ─── ACTIVITY LOGS ─────────────────────────────────────────────────────────────
export const activityLogsService = {
  getAll: (limit = 500) =>
    supabase.from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit),

  getByUser: (userId: string) =>
    supabase.from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),

  getByModule: (module: string) =>
    supabase.from('activity_logs')
      .select('*')
      .eq('module', module)
      .order('created_at', { ascending: false }),
}

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────
export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    const [reqs, candidates, submissions, interviews, offers, joinings, recruiters, clients, vendors] = await Promise.all([
      supabase.from('requirements').select('status'),
      supabase.from('candidates').select('id', { count: 'exact', head: true }),
      supabase.from('submissions').select('id', { count: 'exact', head: true }),
      supabase.from('interviews').select('id', { count: 'exact', head: true }),
      supabase.from('offers').select('id', { count: 'exact', head: true }),
      supabase.from('offers').select('id', { count: 'exact', head: true }).eq('status', 'joined'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'recruiter').eq('status', 'approved'),
      supabase.from('clients').select('id', { count: 'exact', head: true }),
      supabase.from('vendors').select('id', { count: 'exact', head: true }),
    ])
    const reqData = reqs.data ?? []
    return {
      requirements: reqData.length,
      openRequirements: reqData.filter(r => r.status === 'open').length,
      closedRequirements: reqData.filter(r => r.status === 'closed').length,
      filledRequirements: reqData.filter(r => r.status === 'filled').length,
      candidates: candidates.count ?? 0,
      submissions: submissions.count ?? 0,
      interviews: interviews.count ?? 0,
      offers: offers.count ?? 0,
      joinings: joinings.count ?? 0,
      recruiters: recruiters.count ?? 0,
      clients: clients.count ?? 0,
      vendors: vendors.count ?? 0,
    }
  },

  getRecruiterKPIs: async (since?: string): Promise<RecruiterKPI[]> => {
    const query = supabase.from('submissions')
      .select('submitted_by, status, profiles!submitted_by(full_name)')
    if (since) query.gte('created_at', since)
    const { data } = await query
    const map: Record<string, RecruiterKPI> = {}
    ;(data ?? []).forEach((s: any) => {
      const id = s.submitted_by
      if (!map[id]) {
        map[id] = { user_id: id, full_name: s.profiles?.full_name ?? 'Unknown', submissions: 0, interviews: 0, offers: 0, joinings: 0, conversion_rate: 0 }
      }
      map[id].submissions++
      if (['l1_cleared','l2_cleared','final_round','offered','joined'].includes(s.status)) map[id].interviews++
      if (['offered','joined'].includes(s.status)) map[id].offers++
      if (s.status === 'joined') map[id].joinings++
    })
    return Object.values(map).map(kpi => ({
      ...kpi,
      conversion_rate: kpi.submissions > 0 ? Math.round((kpi.joinings / kpi.submissions) * 100) : 0,
    }))
  },

  getSubmissionsByMonth: async () => {
    const { data } = await supabase
      .from('submissions')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
    const map: Record<string, number> = {}
    ;(data ?? []).forEach((s: any) => {
      const k = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      map[k] = (map[k] ?? 0) + 1
    })
    return Object.entries(map).map(([month, count]) => ({ month, count }))
  },
}

// ─── STORAGE HELPERS ─────────────────────────────────────────────────────────
// All PII-bearing buckets (resumes, jd-files, candidate-documents) are
// private. Upload helpers return the storage PATH, not a URL — callers
// must request a fresh, short-lived signed URL whenever a file is actually
// opened, via getSignedUrl() below (or the openSignedFile() helper in
// src/lib/utils.ts).
export const storageService = {
  uploadResume: async (candidateId: string, file: File) => {
    const path = `${candidateId}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('resumes').upload(path, file, { upsert: true })
    return { path: error ? null : path, error }
  },

  uploadJD: async (requirementId: string, file: File) => {
    const path = `${requirementId}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('jd-files').upload(path, file, { upsert: true })
    return { path: error ? null : path, error }
  },

  uploadOfferLetter: async (offerId: string, file: File) => {
    const path = `${offerId}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('candidate-documents').upload(path, file, { upsert: true })
    return { path: error ? null : path, error }
  },

  getSignedUrl: async (bucket: 'resumes' | 'jd-files' | 'candidate-documents', path: string, expiresIn = 3600) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
    return { url: data?.signedUrl ?? null, error }
  },
}
