import { z } from 'zod'

// ─── Common ───────────────────────────────────────────────────────────────────
const phone = z.string().optional().or(z.literal(''))
const optStr = z.string().optional().or(z.literal(''))
const optNum = z.string()
  .optional()
  .transform(v => (v && v !== '' ? Number(v) : null))
  .refine(v => v === null || !isNaN(v as number), 'Must be a number')

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'At least 6 characters'),
})

export const signupSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'At least 6 characters'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email required'),
})

export const resetPasswordSchema = z.object({
  password: z.string().min(6, 'At least 6 characters'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

// ─── Client ───────────────────────────────────────────────────────────────────
export const clientSchema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  contact_person: optStr,
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: phone,
  industry: optStr,
  address: optStr,
  gst_number: optStr,
  sla_details: optStr,
  contract_details: optStr,
  status: z.enum(['active', 'inactive']),
  notes: optStr,
})
export type ClientSchema = z.infer<typeof clientSchema>

// ─── Vendor ───────────────────────────────────────────────────────────────────
export const vendorSchema = z.object({
  vendor_name: z.string().min(1, 'Vendor name is required'),
  contact_person: optStr,
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  mobile: phone,
  location: optStr,
  gst_number: optStr,
  status: z.enum(['active', 'inactive']),
  notes: optStr,
})
export type VendorSchema = z.infer<typeof vendorSchema>

// ─── Requirement ──────────────────────────────────────────────────────────────
export const requirementSchema = z.object({
  fg_id: z.string().min(1, 'FG ID is required'),
  client_id: optStr,
  requirement_title: z.string().min(2, 'Title is required'),
  category: optStr,
  mandatory_skills: z.string().optional(),
  secondary_skills: z.string().optional(),
  experience_min: z.string().optional().transform(v => v ? Number(v) : null),
  experience_max: z.string().optional().transform(v => v ? Number(v) : null),
  location: optStr,
  openings: z.string().min(1).transform(v => Number(v) || 1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['open', 'hold', 'closed', 'filled']),
  notes: optStr,
})
export type RequirementSchema = z.infer<typeof requirementSchema>

// ─── Candidate ────────────────────────────────────────────────────────────────
export const candidateSchema = z.object({
  candidate_name: z.string().min(2, 'Full name required'),
  mobile_number: z
    .string()
    .min(10, 'Valid mobile number required')
    .regex(/^[+\d\s\-()]{10,15}$/, 'Invalid mobile format'),
  email_address: z.string().email('Valid email required'),
  pan_number: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(v => !v || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v), 'Invalid PAN format (e.g. ABCDE1234F)'),
  date_of_birth: optStr,
  current_location: optStr,
  preferred_location: optStr,
  total_experience: z.string().optional().transform(v => v ? Number(v) : null),
  relevant_experience: z.string().optional().transform(v => v ? Number(v) : null),
  skills: z.string().optional(),
  current_employer: optStr,
  current_ctc: z.string().optional().transform(v => v ? Number(v) : null),
  expected_ctc: z.string().optional().transform(v => v ? Number(v) : null),
  notice_period: z.string().optional().transform(v => v ? Number(v) : null),
  can_join_within: z.string().optional().transform(v => v ? Number(v) : null),
  highest_qualification: optStr,
  university: optStr,
  passing_year: z.string().optional().transform(v => v ? Number(v) : null),
  notes: optStr,
})
export type CandidateSchema = z.infer<typeof candidateSchema>

// ─── Submission ───────────────────────────────────────────────────────────────
export const submissionSchema = z.object({
  submission_date: z.string().min(1, 'Date required'),
  requirement_id: z.string().uuid('Select a requirement'),
  candidate_id: z.string().uuid('Select a candidate'),
  vendor_id: optStr,
  partner_name: optStr,
  status: z.enum(['sourced', 'submitted', 'shortlisted', 'interview_scheduled', 'l1_cleared', 'l2_cleared', 'final_round', 'offered', 'joined', 'rejected']),
  notes: optStr,
})
export type SubmissionSchema = z.infer<typeof submissionSchema>

// ─── Interview ────────────────────────────────────────────────────────────────
export const interviewSchema = z.object({
  submission_id: z.string().min(1, 'Select a submission'),
  candidate_id: z.string().min(1),
  requirement_id: z.string().min(1),
  interview_date: z.string().min(1, 'Date required'),
  interview_time: optStr,
  interview_round: z.string().min(1, 'Round required'),
  interview_mode: z.enum(['video', 'phone', 'in_person']),
  interviewer: optStr,
  feedback: optStr,
  result: z.enum(['pending', 'cleared', 'rejected', 'on_hold', 'no_show']),
})
export type InterviewSchema = z.infer<typeof interviewSchema>

// ─── Offer ────────────────────────────────────────────────────────────────────
export const offerSchema = z.object({
  submission_id: z.string().min(1, 'Select a submission'),
  candidate_id: z.string().min(1),
  requirement_id: z.string().min(1),
  offer_date: optStr,
  offered_ctc: z.string().optional().transform(v => v ? Number(v) : null),
  joining_date: optStr,
  status: z.enum(['offered', 'accepted', 'declined', 'joined', 'no_show', 'deferred']),
  notes: optStr,
})
export type OfferSchema = z.infer<typeof offerSchema>

// ─── Team ─────────────────────────────────────────────────────────────────────
export const teamSchema = z.object({
  team_name: z.string().min(2, 'Team name required'),
  manager_id: optStr,
  description: optStr,
  status: z.enum(['active', 'inactive']),
})
export type TeamSchema = z.infer<typeof teamSchema>

// ─── Target ───────────────────────────────────────────────────────────────────
export const targetSchema = z.object({
  user_id: z.string().uuid('Select a recruiter'),
  team_id: optStr,
  period_type: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  period_start: z.string().min(1, 'Start date required'),
  period_end: z.string().min(1, 'End date required'),
  target_submissions: z.string().transform(v => Number(v) || 0),
  target_interviews: z.string().transform(v => Number(v) || 0),
  target_offers: z.string().transform(v => Number(v) || 0),
  target_joinings: z.string().transform(v => Number(v) || 0),
})
export type TargetSchema = z.infer<typeof targetSchema>
