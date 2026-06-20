import { supabase } from './supabase'
import type {
  LoginSession, OnlineUser, RecruiterProfileSummary, RecruiterPerformance,
  RecruiterWorkload, AttendanceRecord, LeaderboardEntry, LiveActivityItem,
} from '@/types'

// ─── RECRUITER PROFILE CARD ──────────────────────────────────────────────────
// All three calls are independent reads keyed only by p_user_id, so the
// caller (RecruiterProfileCard) fires them with Promise.all rather than
// sequentially — this is what the feature spec's "Optimized Queries using
// Promise.all" requirement refers to.
export const recruiterInsightsService = {
  getProfileSummary: (userId: string) =>
    supabase.rpc('get_recruiter_profile_summary', { p_user_id: userId }).single<RecruiterProfileSummary>(),

  getPerformance: (userId: string) =>
    supabase.rpc('get_recruiter_performance', { p_user_id: userId }).single<RecruiterPerformance>(),

  getWorkload: (userId: string) =>
    supabase.rpc('get_recruiter_workload', { p_user_id: userId }).single<RecruiterWorkload>(),

  getLeaderboard: (limit = 10) =>
    supabase.rpc('get_recruiter_leaderboard', { p_limit: limit }) as unknown as Promise<{ data: LeaderboardEntry[] | null; error: Error | null }>,
}

// ─── LOGIN SESSIONS / ONLINE USERS ───────────────────────────────────────────
export const loginSessionService = {
  create: (session: Omit<LoginSession, 'id' | 'created_at' | 'updated_at' | 'logout_time' | 'session_duration_minutes' | 'is_active'>) =>
    supabase.from('user_login_sessions').insert({ ...session, is_active: true }).select().single<LoginSession>(),

  heartbeat: (sessionId: string) =>
    // Touches updated_at, which doubles as the "last seen" heartbeat that
    // get_online_users()/get_user_attendance_report() use to decide whether
    // an active session is still genuinely online (<15 min) or stale.
    supabase.from('user_login_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId).eq('is_active', true),

  logout: (sessionId: string) =>
    supabase.from('user_login_sessions').update({ logout_time: new Date().toISOString() }).eq('id', sessionId).eq('is_active', true),

  getOnlineUsers: () =>
    supabase.rpc('get_online_users') as unknown as Promise<{ data: OnlineUser[] | null; error: Error | null }>,
}

// ─── ATTENDANCE REPORT (admin only) ─────────────────────────────────────────
export const attendanceService = {
  getReport: (startDate: string, endDate: string) =>
    supabase.rpc('get_user_attendance_report', { p_start: startDate, p_end: endDate }) as unknown as Promise<{ data: AttendanceRecord[] | null; error: Error | null }>,
}

// ─── LIVE ACTIVITY FEED ──────────────────────────────────────────────────────
export const liveActivityService = {
  getFeed: (limit = 50) =>
    supabase.rpc('get_live_activity_feed', { p_limit: limit }) as unknown as Promise<{ data: LiveActivityItem[] | null; error: Error | null }>,
}
