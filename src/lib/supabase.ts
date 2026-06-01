import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'recruiter'
          status: 'pending' | 'approved' | 'rejected' | 'inactive'
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      clients: {
        Row: {
          id: string
          client_name: string
          contact_person: string | null
          email: string | null
          phone: string | null
          industry: string | null
          status: 'active' | 'inactive'
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['clients']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['clients']['Insert']>
      }
      vendors: {
        Row: {
          id: string
          vendor_name: string
          contact_person: string | null
          email: string | null
          mobile: string | null
          location: string | null
          gst_number: string | null
          status: 'active' | 'inactive'
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['vendors']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['vendors']['Insert']>
      }
      requirements: {
        Row: {
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
          priority: 'low' | 'medium' | 'high' | 'urgent'
          status: 'open' | 'hold' | 'closed' | 'filled'
          jd_url: string | null
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['requirements']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['requirements']['Insert']>
      }
      candidates: {
        Row: {
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
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['candidates']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['candidates']['Insert']>
      }
      submissions: {
        Row: {
          id: string
          submission_date: string
          requirement_id: string
          candidate_id: string
          partner_name: string | null
          status: 'sourced' | 'submitted' | 'shortlisted' | 'interview_scheduled' | 'l1_cleared' | 'l2_cleared' | 'final_round' | 'offered' | 'joined' | 'rejected'
          notes: string | null
          submitted_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['submissions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['submissions']['Insert']>
      }
      interviews: {
        Row: {
          id: string
          submission_id: string
          candidate_id: string
          requirement_id: string
          interview_date: string
          interview_time: string | null
          interview_round: string
          interviewer: string | null
          feedback: string | null
          result: 'pending' | 'cleared' | 'rejected' | 'on_hold'
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['interviews']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['interviews']['Insert']>
      }
      offers: {
        Row: {
          id: string
          submission_id: string
          candidate_id: string
          requirement_id: string
          offer_date: string | null
          offered_ctc: number | null
          joining_date: string | null
          status: 'offered' | 'accepted' | 'declined' | 'joined' | 'no_show'
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['offers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['offers']['Insert']>
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          user_name: string
          role: string
          module: string
          action: string
          details: string | null
          record_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['activity_logs']['Row'], 'id' | 'created_at'>
        Update: never
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: 'info' | 'success' | 'warning' | 'error'
          read: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
    }
  }
}
