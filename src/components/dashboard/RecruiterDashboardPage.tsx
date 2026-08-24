import React, { useEffect, useState } from 'react'
import { FileText, Calendar, Bell, Send, Gift, UserCheck, TrendingUp, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/components'
import { cn } from '@/lib/utils'
import { dashboardService } from '@/lib/services'
import type { RecruiterKPI } from '@/types'
import { CompanyInfoCard } from './CompanyInfoCard'
import { LiveActivityFeed } from './LiveActivityFeed'

interface Stats {
  assignedRequirements: number
  todaysInterviews: number
  pendingFollowUps: number
  submittedCandidates: number
  offersPending: number
  joiningsPending: number
}

interface DeadlineRow {
  id: string
  fg_id: string
  requirement_title: string
  deadline_date: string
}

// Recruiter's own dashboard — a deliberately different view from the admin/
// leadership DashboardPage. Everything here is scoped to "me" (the signed-in
// recruiter): requirements assigned to me (via requirements.assigned_to,
// which leadership sets from RequirementsPage), submissions I made, and
// interviews/offers I created. This does NOT restrict what a recruiter can
// SEE elsewhere in the app (Requirements/Candidates/Submissions stay a
// shared workspace by design) — it's purely a "what's on my plate today"
// summary.
export function RecruiterDashboardPage() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState<Stats>({
    assignedRequirements: 0, todaysInterviews: 0, pendingFollowUps: 0,
    submittedCandidates: 0, offersPending: 0, joiningsPending: 0,
  })
  const [deadlines, setDeadlines] = useState<DeadlineRow[]>([])
  const [myKpi, setMyKpi] = useState<RecruiterKPI | null>(null)
  const [loading, setLoading] = useState(true)

  // Intentionally re-fetches only when `user` becomes available, not on
  // every re-render that adding the fetchAll closure itself would cause.
  useEffect(() => {
    if (user) fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const fetchAll = async () => {
    if (!user) return
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      const [
        assignedReqs, todaysInterviews, openSubs, submittedCount,
        offersPending, joiningsPending, upcomingDeadlines, kpis,
      ] = await Promise.all([
        supabase.from('requirements').select('id', { count: 'exact', head: true })
          .eq('assigned_to', user.id).eq('status', 'open'),
        supabase.from('interviews').select('id', { count: 'exact', head: true })
          .eq('created_by', user.id).eq('interview_date', today),
        supabase.from('submissions').select('id', { count: 'exact', head: true })
          .eq('submitted_by', user.id)
          .in('status', ['sourced', 'submitted', 'shortlisted', 'interview_scheduled']),
        supabase.from('submissions').select('id', { count: 'exact', head: true })
          .eq('submitted_by', user.id),
        supabase.from('offers').select('id', { count: 'exact', head: true })
          .eq('created_by', user.id).eq('status', 'offered'),
        supabase.from('offers').select('id', { count: 'exact', head: true })
          .eq('created_by', user.id).eq('status', 'accepted'),
        supabase.from('requirements').select('id, fg_id, requirement_title, deadline_date')
          .eq('assigned_to', user.id).eq('status', 'open')
          .not('deadline_date', 'is', null)
          .order('deadline_date', { ascending: true })
          .limit(5),
        dashboardService.getRecruiterKPIs(),
      ])

      setStats({
        assignedRequirements: assignedReqs.count ?? 0,
        todaysInterviews: todaysInterviews.count ?? 0,
        pendingFollowUps: openSubs.count ?? 0,
        submittedCandidates: submittedCount.count ?? 0,
        offersPending: offersPending.count ?? 0,
        joiningsPending: joiningsPending.count ?? 0,
      })
      setDeadlines(upcomingDeadlines.data ?? [])
      setMyKpi(kpis.find(k => k.user_id === user.id) ?? null)
    } finally {
      setLoading(false)
    }
  }

  const cards = [
    { label: 'Assigned Requirements', value: stats.assignedRequirements, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
    { label: "Today's Interviews", value: stats.todaysInterviews, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' },
    { label: 'Pending Follow-ups', value: stats.pendingFollowUps, icon: Bell, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950' },
    { label: 'Submitted Candidates', value: stats.submittedCandidates, icon: Send, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950' },
    { label: 'Offers Pending', value: stats.offersPending, icon: Gift, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950' },
    { label: 'Joinings Pending', value: stats.joiningsPending, icon: UserCheck, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950' },
  ]

  const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Welcome back, {profile?.full_name?.split(' ')[0]} 👋</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Here's what's on your plate today</p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(card => (
          <div key={card.label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{loading ? '—' : card.value.toLocaleString()}</p>
              </div>
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", card.bg)}>
                <card.icon className={cn("h-4.5 w-4.5", card.color)} style={{ height: '18px', width: '18px' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-1.5"><Clock className="h-4 w-4" /> Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            {deadlines.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">No upcoming deadlines assigned to you</div>
            ) : (
              <div className="space-y-2.5">
                {deadlines.map(d => {
                  const days = daysUntil(d.deadline_date)
                  return (
                    <div key={d.id} className="flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{d.requirement_title}</p>
                        <p className="mono text-muted-foreground">{d.fg_id}</p>
                      </div>
                      <span className={cn(
                        "flex-shrink-0 ml-2 px-2 py-0.5 rounded-full font-medium",
                        days < 0 ? "bg-red-50 text-red-600 dark:bg-red-950" :
                        days <= 3 ? "bg-amber-50 text-amber-600 dark:bg-amber-950" :
                        "bg-slate-50 text-slate-600 dark:bg-slate-900"
                      )}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d left`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-1.5"><TrendingUp className="h-4 w-4" /> My Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {!myKpi ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">No submissions yet</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Total Submissions</p>
                  <p className="text-lg font-bold">{myKpi.submissions}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Interviews Reached</p>
                  <p className="text-lg font-bold">{myKpi.interviews}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Offers</p>
                  <p className="text-lg font-bold">{myKpi.offers}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Joinings</p>
                  <p className="text-lg font-bold">{myKpi.joinings}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Conversion Rate</p>
                  <p className="text-lg font-bold">{myKpi.conversion_rate}%</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-1">
          <CompanyInfoCard />
        </div>
      </div>

      <LiveActivityFeed />
    </div>
  )
}
