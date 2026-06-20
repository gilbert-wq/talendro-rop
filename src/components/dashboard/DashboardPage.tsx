import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { Users, FileText, Send, Calendar, Gift, UserCheck, Building2, TrendingUp, Activity } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/components'
import { formatDateTime, cn } from '@/lib/utils'
import { OnlineUsersWidget } from './OnlineUsersWidget'
import { RecruiterLeaderboard } from './RecruiterLeaderboard'
import { LiveActivityFeed } from './LiveActivityFeed'

interface Stats {
  requirements: number
  openRequirements: number
  closedRequirements: number
  recruiters: number
  candidates: number
  submissions: number
  interviews: number
  offers: number
  joinings: number
  clients: number
}

const COLORS = ['#1e3a8a', '#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export function DashboardPage() {
  const { isAdmin, profile } = useAuth()
  const [stats, setStats] = useState<Stats>({
    requirements: 0, openRequirements: 0, closedRequirements: 0,
    recruiters: 0, candidates: 0, submissions: 0,
    interviews: 0, offers: 0, joinings: 0, clients: 0,
  })
  const [submissionsByMonth, setSubmissionsByMonth] = useState<any[]>([])
  const [statusData, setStatusData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [reqs, candidates, submissions, interviews, offers, joinings, recruiters, clients] = await Promise.all([
        supabase.from('requirements').select('status'),
        supabase.from('candidates').select('id', { count: 'exact', head: true }),
        supabase.from('submissions').select('status, created_at'),
        supabase.from('interviews').select('id', { count: 'exact', head: true }),
        supabase.from('offers').select('status'),
        supabase.from('offers').select('status').eq('status', 'joined'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'recruiter').eq('status', 'approved'),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
      ])

      const reqData = reqs.data ?? []
      setStats({
        requirements: reqData.length,
        openRequirements: reqData.filter(r => r.status === 'open').length,
        closedRequirements: reqData.filter(r => r.status === 'closed').length,
        recruiters: recruiters.count ?? 0,
        candidates: candidates.count ?? 0,
        submissions: (submissions.data ?? []).length,
        interviews: interviews.count ?? 0,
        offers: (offers.data ?? []).length,
        joinings: (joinings.data ?? []).length,
        clients: clients.count ?? 0,
      })

      // Submissions by month
      const subsData = submissions.data ?? []
      const monthMap: Record<string, number> = {}
      subsData.forEach((s: any) => {
        const month = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        monthMap[month] = (monthMap[month] ?? 0) + 1
      })
      setSubmissionsByMonth(Object.entries(monthMap).slice(-6).map(([month, count]) => ({ month, count })))

      // Status distribution
      const statusMap: Record<string, number> = {}
      subsData.forEach((s: any) => {
        statusMap[s.status] = (statusMap[s.status] ?? 0) + 1
      })
      setStatusData(Object.entries(statusMap).map(([name, value]) => ({ name, value })))
    } finally {
      setLoading(false)
    }
  }

  const adminCards = [
    { label: 'Total Requirements', value: stats.requirements, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
    { label: 'Open Requirements', value: stats.openRequirements, icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950' },
    { label: 'Closed Requirements', value: stats.closedRequirements, icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-950' },
    { label: 'Total Recruiters', value: stats.recruiters, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950' },
    { label: 'Total Candidates', value: stats.candidates, icon: UserCheck, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950' },
    { label: 'Total Submissions', value: stats.submissions, icon: Send, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950' },
    { label: 'Total Interviews', value: stats.interviews, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' },
    { label: 'Total Offers', value: stats.offers, icon: Gift, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950' },
    { label: 'Total Joinings', value: stats.joinings, icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950' },
  ]

  const recruiterCards = [
    { label: 'Requirements', value: stats.requirements, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
    { label: 'Candidates', value: stats.candidates, icon: UserCheck, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950' },
    { label: 'Submissions', value: stats.submissions, icon: Send, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950' },
    { label: 'Interviews', value: stats.interviews, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' },
    { label: 'Offers', value: stats.offers, icon: Gift, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950' },
    { label: 'Joinings', value: stats.joinings, icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950' },
  ]

  const cards = isAdmin ? adminCards : recruiterCards

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Welcome back, {profile?.full_name?.split(' ')[0]} 👋</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Here's what's happening in your recruitment pipeline</p>
      </div>

      {/* Stat Cards */}
      <div className={cn("grid gap-4", isAdmin ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-6")}>
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

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Monthly Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            {submissionsByMonth.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={submissionsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pipeline Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1.5 text-xs">
                  {statusData.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground capitalize">{s.name.replace(/_/g, ' ')}</span>
                      <span className="font-semibold ml-auto">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FEATURE 4/7/8: live online users + leaderboard are admin-only
          additions; the live activity feed replaces the old static,
          one-time-fetch "Recent Activity" card in the same slot — it's a
          strict upgrade (realtime updates, and RLS already scopes a
          recruiter to their own activity vs an admin seeing everyone's, so
          no separate recruiter-only layout is needed here). */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OnlineUsersWidget />
          <RecruiterLeaderboard />
        </div>
      )}
      <LiveActivityFeed />
    </div>
  )
}
