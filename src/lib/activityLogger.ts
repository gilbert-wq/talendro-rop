import { supabase } from './supabase'

export async function logActivity(params: {
  module: string
  action: string
  details?: string
  recordId?: string
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: profile?.full_name ?? user.email ?? 'Unknown',
      role: profile?.role ?? 'recruiter',
      module: params.module,
      action: params.action,
      details: params.details ?? null,
      record_id: params.recordId ?? null,
    })
  } catch (e) {
    console.error('Failed to log activity:', e)
  }
}
