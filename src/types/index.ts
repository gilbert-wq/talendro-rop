// ============================================================
// TALENDRO ROP — COMPLETE TYPE DEFINITIONS
// ============================================================

export type UserRole = 'admin' | 'recruiter'
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'inactive'
export type RequirementStatus = 'open' | 'hold' | 'closed' | 'filled'
export type RequirementPriority = 'low' | 'medium' | 'high' | 'urgent'
export type SubmissionStatus =
  | 'sourced' | 'submitted' | 'shortlisted' | 'interview_scheduled'
  | 'l1_cleared' | 'l2_cleared' | 'final_round' | 'offered' | 'joined' | 'rejected'
export type InterviewResult = 'pending' | 'cleared' | 'rejected' | 'on_hold' | 'no_show'
export type OfferStatus = 'offered' | 'accepted' | 'declined' | 'joined' | 'no_show' | 'deferred'
export type ClientStatus = 'active' | 'inactive'
export type VendorStatus = 'active' | 'inactive'
export type NotificationType = 'info' | 'success' | 'warning' | 'error'
export type DocumentType = 'resume' | 'offer_letter' | 'id_proof' | 'certificate' | 'other'
export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type InterviewMode = 'video' | 'phone' | 'in_person'

// ============================================================
// PROFILE / USER
// ============================================================
export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  status: UserStatus
  phone: string | null
  avatar_url: string | null
  employee_id: string | null
  alternate_phone: string | null
  date_of_joining: string | null
  department: string | null
  designation: string | null
  reporting_manager: string | null
  date_of_birth: string | null
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null
  current_address: string | null
  permanent_address: string | null
  emergency_contact_name: string | null
  emergency_contact_number: string | null
  education: string | null
  experience_years: number | null
  profile_completion_percentage: number
  profile_completed: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// USER MANAGEMENT / LOGIN TRACKING / ATTENDANCE / ANALYTICS
// ============================================================

export interface LoginSession {
  id: string
  user_id: string
  login_time: string
  logout_time: string | null
  session_duration_minutes: number | null
  ip_address: string | null
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown' | null
  browser_name: string | null
  operating_system: string | null
  location: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OnlineUser {
  user_id: string
  full_name: string
  role: UserRole
  login_time: string
  online_minutes: number
}

export interface RecruiterProfileSummary {
  id: string
  full_name: string
  employee_id: string | null
  email: string
  phone: string | null
  alternate_phone: string | null
  department: string | null
  designation: string | null
  reporting_manager_name: string | null
  date_of_joining: string | null
  date_of_birth: string | null
  gender: string | null
  current_address: string | null
  permanent_address: string | null
  emergency_contact_name: string | null
  emergency_contact_number: string | null
  education: string | null
  experience_years: number | null
  avatar_url: string | null
  status: UserStatus
  last_login_at: string | null
  created_at: string
  profile_completion_percentage: number
}

export interface RecruiterPerformance {
  candidates_added: number
  candidates_joined: number
  submissions_made: number
  interviews_scheduled: number
  interviews_cleared: number
  offers_released: number
  offers_accepted: number
  offer_conversion_rate: number
  joining_conversion_rate: number
}

export interface RecruiterWorkload {
  active_requirements: number
  active_candidates: number
  open_interviews: number
  pending_offers: number
  pending_followups: number
  pending_actions: number
}

export interface AttendanceRecord {
  user_id: string
  full_name: string
  employee_id: string | null
  role: UserRole
  department: string | null
  attendance_date: string
  first_login: string | null
  last_logout: string | null
  total_duration_minutes: number
  status: 'online' | 'offline'
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  full_name: string
  score: number
  candidates_added: number
  submissions_made: number
  interviews_cleared: number
  offers_accepted: number
  joins: number
  is_top_performer: boolean
}

export interface LiveActivityItem {
  id: string
  user_id: string
  user_name: string
  role: UserRole
  module_name: string
  activity_type: string
  activity_description: string | null
  reference_id: string | null
  created_at: string
}

// ============================================================
// CLIENT
// ============================================================
export interface Client {
  id: string
  client_name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  industry: string | null
  address: string | null
  gst_number: string | null
  sla_details: string | null
  contract_details: string | null
  status: ClientStatus
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ClientFormData {
  client_name: string
  contact_person: string
  email: string
  phone: string
  industry: string
  address: string
  gst_number: string
  sla_details: string
  contract_details: string
  status: ClientStatus
  notes: string
}

// ============================================================
// VENDOR
// ============================================================
export interface Vendor {
  id: string
  vendor_name: string
  contact_person: string | null
  email: string | null
  mobile: string | null
  location: string | null
  gst_number: string | null
  status: VendorStatus
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface VendorFormData {
  vendor_name: string
  contact_person: string
  email: string
  mobile: string
  location: string
  gst_number: string
  status: VendorStatus
  notes: string
}

// ============================================================
// REQUIREMENT
// ============================================================
export interface Requirement {
  id: string
  fg_id: string
  client_id: string | null
  requirement_title: string
  category: string | null
  mandatory_skills: string[]
  secondary_skills: string[]
  experience_min: number | null
  experience_max: number | null
  location: string | null
  openings: number
  priority: RequirementPriority
  status: RequirementStatus
  jd_url: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  // Joined
  clients?: Pick<Client, 'client_name'> | null
}

export interface RequirementFormData {
  fg_id: string
  client_id: string
  requirement_title: string
  category: string
  mandatory_skills: string // comma-separated
  secondary_skills: string
  experience_min: string
  experience_max: string
  location: string
  openings: string
  priority: RequirementPriority
  status: RequirementStatus
  notes: string
}

// ============================================================
// CANDIDATE
// ============================================================
export interface Candidate {
  id: string
  candidate_name: string
  mobile_number: string
  email_address: string
  pan_number: string | null
  date_of_birth: string | null
  current_location: string | null
  preferred_location: string | null
  total_experience: number | null
  relevant_experience: number | null
  skills: string[]
  current_employer: string | null
  current_ctc: number | null
  expected_ctc: number | null
  notice_period: number | null
  can_join_within: number | null
  highest_qualification: string | null
  university: string | null
  passing_year: number | null
  resume_url: string | null
  notes: string | null
  tags: string[]
  created_by: string
  created_at: string
  updated_at: string
}

export interface CandidateFormData {
  candidate_name: string
  mobile_number: string
  email_address: string
  pan_number: string
  date_of_birth: string
  current_location: string
  preferred_location: string
  total_experience: string
  relevant_experience: string
  skills: string
  current_employer: string
  current_ctc: string
  expected_ctc: string
  notice_period: string
  can_join_within: string
  highest_qualification: string
  university: string
  passing_year: string
  notes: string
}

// ============================================================
// CANDIDATE DOCUMENT
// ============================================================
export interface CandidateDocument {
  id: string
  candidate_id: string
  document_name: string
  document_type: DocumentType
  file_url: string
  file_size: number | null
  uploaded_by: string
  created_at: string
}

// ============================================================
// CANDIDATE NOTE
// ============================================================
export interface CandidateNote {
  id: string
  candidate_id: string
  note: string
  created_by: string
  created_at: string
  profiles?: Pick<Profile, 'full_name'> | null
}

// ============================================================
// SUBMISSION
// ============================================================
export interface Submission {
  id: string
  submission_date: string
  requirement_id: string
  candidate_id: string
  vendor_id: string | null
  partner_name: string | null
  status: SubmissionStatus
  notes: string | null
  submitted_by: string
  created_at: string
  updated_at: string
  // Joined
  candidates?: CandidateSubmissionView | null
  requirements?: RequirementSubmissionView | null
  profiles?: Pick<Profile, 'full_name'> | null
  vendors?: Pick<Vendor, 'vendor_name'> | null
}

export interface CandidateSubmissionView {
  candidate_name: string
  mobile_number: string
  email_address: string
  current_location: string | null
  preferred_location: string | null
  total_experience: number | null
  relevant_experience: number | null
  notice_period: number | null
  can_join_within: number | null
  current_ctc: number | null
  expected_ctc: number | null
  pan_number: string | null
  date_of_birth: string | null
  highest_qualification: string | null
  university: string | null
  passing_year: number | null
  current_employer: string | null
  skills: string[]
}

export interface RequirementSubmissionView {
  fg_id: string
  requirement_title: string
  clients?: Pick<Client, 'client_name'> | null
}

export interface SubmissionFormData {
  submission_date: string
  requirement_id: string
  candidate_id: string
  vendor_id: string
  partner_name: string
  status: SubmissionStatus
  notes: string
}

// ============================================================
// CANDIDATE STAGE HISTORY
// ============================================================
export interface CandidateStageHistory {
  id: string
  submission_id: string
  candidate_id: string
  from_status: string | null
  to_status: string
  notes: string | null
  changed_by: string
  created_at: string
  profiles?: Pick<Profile, 'full_name'> | null
}

// ============================================================
// INTERVIEW
// ============================================================
export interface Interview {
  id: string
  submission_id: string
  candidate_id: string
  requirement_id: string
  interview_date: string
  interview_time: string | null
  interview_round: string
  interview_mode: InterviewMode
  interviewer: string | null
  feedback: string | null
  result: InterviewResult
  created_by: string
  created_at: string
  updated_at: string
  // Joined
  candidates?: Pick<Candidate, 'candidate_name' | 'mobile_number'> | null
  requirements?: Pick<Requirement, 'fg_id' | 'requirement_title'> | null
}

export interface InterviewFormData {
  submission_id: string
  candidate_id: string
  requirement_id: string
  interview_date: string
  interview_time: string
  interview_round: string
  interview_mode: InterviewMode
  interviewer: string
  feedback: string
  result: InterviewResult
}

// ============================================================
// OFFER
// ============================================================
export interface Offer {
  id: string
  submission_id: string
  candidate_id: string
  requirement_id: string
  offer_date: string | null
  offered_ctc: number | null
  joining_date: string | null
  offer_letter_url: string | null
  status: OfferStatus
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  // Joined
  candidates?: Pick<Candidate, 'candidate_name' | 'mobile_number' | 'email_address'> | null
  requirements?: Pick<Requirement, 'fg_id' | 'requirement_title'> | null
}

export interface OfferFormData {
  submission_id: string
  candidate_id: string
  requirement_id: string
  offer_date: string
  offered_ctc: string
  joining_date: string
  status: OfferStatus
  notes: string
}

// ============================================================
// TEAM
// ============================================================
export interface Team {
  id: string
  team_name: string
  manager_id: string | null
  description: string | null
  status: 'active' | 'inactive'
  created_by: string
  created_at: string
  updated_at: string
  profiles?: Pick<Profile, 'full_name'> | null
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role_in_team: string | null
  joined_at: string
  profiles?: Pick<Profile, 'full_name' | 'email'> | null
}

// ============================================================
// TARGET / KPI
// ============================================================
export interface Target {
  id: string
  user_id: string
  team_id: string | null
  period_type: PeriodType
  period_start: string
  period_end: string
  target_submissions: number
  target_interviews: number
  target_offers: number
  target_joinings: number
  actual_submissions: number
  actual_interviews: number
  actual_offers: number
  actual_joinings: number
  created_by: string
  created_at: string
  updated_at: string
  profiles?: Pick<Profile, 'full_name'> | null
}

export interface TargetFormData {
  user_id: string
  team_id: string
  period_type: PeriodType
  period_start: string
  period_end: string
  target_submissions: string
  target_interviews: string
  target_offers: string
  target_joinings: string
}

// ============================================================
// ACTIVITY LOG
// ============================================================
export interface ActivityLog {
  id: string
  user_id: string
  user_name: string
  role: string
  module: string
  action: string
  details: string | null
  record_id: string | null
  ip_address: string | null
  created_at: string
}

// ============================================================
// NOTIFICATION
// ============================================================
export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  read: boolean
  action_url: string | null
  created_at: string
}

// ============================================================
// DASHBOARD STATS
// ============================================================
export interface DashboardStats {
  requirements: number
  openRequirements: number
  closedRequirements: number
  filledRequirements: number
  candidates: number
  submissions: number
  interviews: number
  offers: number
  joinings: number
  recruiters: number
  clients: number
  vendors: number
}

// ============================================================
// RECRUITER KPI
// ============================================================
export interface RecruiterKPI {
  user_id: string
  full_name: string
  submissions: number
  interviews: number
  offers: number
  joinings: number
  conversion_rate: number
}

// ============================================================
// SELECT OPTIONS (for dropdowns)
// ============================================================
export interface SelectOption {
  value: string
  label: string
}

// ============================================================
// TABLE META
// ============================================================
export interface PaginationState {
  pageIndex: number
  pageSize: number
}

export interface SortingState {
  id: string
  desc: boolean
}

// ============================================================
// API RESPONSE WRAPPER
// ============================================================
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  count?: number
}
