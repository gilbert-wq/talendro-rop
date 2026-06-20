import { supabase } from './supabase'

export async function logActivity(params: {
  module: string
  action: string
  details?: string
  recordId?: string
  /** Categorized slug for activity_logs.activity_type (Feature 7). If
   * omitted, derived automatically from `action` (e.g. "Created submission"
   * -> "created_submission") so every pre-existing call site populates this
   * column for free without needing to be touched individually. */
  activityType?: string
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

    const activityType = params.activityType ?? params.action.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: profile?.full_name ?? user.email ?? 'Unknown',
      role: profile?.role ?? 'recruiter',
      module: params.module,
      action: params.action,
      details: params.details ?? null,
      record_id: params.recordId ?? null,
      activity_type: activityType,
    })
  } catch (e) {
    console.error('Failed to log activity:', e)
  }
}

