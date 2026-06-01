import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { Download, FileText, Users, Send, Calendar, Gift, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/forms'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/forms'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/components'
import { downloadCSV, formatDate } from '@/lib/utils'

const COLORS = ['#1e3a8a', '#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export function ReportsPage() {
  const [period, setPeriod] = useState('30')
  const [submissionData, setSubmissionData] = useState<any[]>([])
  const [recruiterData, setRecruiterData] = useState<any[]>([])
  const [statusData, setStatusData] = useState<any[]>([])
  const [clientData, setClientData] = useState<any[]>([])
  const [funnelData, setFunnelData] = useState<any[]>([])
  const [allSubmissions, setAllSubmissions] = useState<any[]>([])
  const [allCandidates, setAllCandidates] = useState<any[]>([])
  const [allReqs, setAllReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchReports() }, [period])

  const fetchReports = async () => {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - Number(period))

    const [{ data: subs }, { data: cands }, { data: reqs }, { data: profiles }] = await Promise.all([
      supabase.from('submissions').select('*, candidates(candidate_name), requirements(fg_id, requirement_title, clients(client_name)), profiles!submitted_by(full_name)').gte('created_at', since.toISOString()),
      supabase.from('candidates').select('*').order('created_at', { ascending: false }),
      supabase.from('requirements').select('*, clients(client_name)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name').eq('role', 'recruiter').eq('status', 'approved'),
    ])

    const subsData = subs ?? []
    setAllSubmissions(subsData)
    setAllCandidates(cands ?? [])
    setAllReqs(reqs ?? [])

    // Submissions by day
    const dayMap: Record<string, number> = {}
    subsData.forEach((s: any) => {
      const day = formatDate(s.created_at)
      dayMap[day] = (dayMap[day] ?? 0) + 1
    })
    setSubmissionData(Object.entries(dayMap).slice(-14).map(([date, count]) => ({ date, count })))

    // By recruiter
    const recMap: Record<string, number> = {}
    subsData.forEach((s: any) => {
      const name = (s as any).profiles?.full_name ?? 'Unknown'
      recMap[name] = (recMap[name] ?? 0) + 1
    })
    setRecruiterData(Object.entries(recMap).map(([name, count]) => ({ name: name.split(' ')[0], count })))

    // Status distribution
    const stMap: Record<string, number> = {}
    subsData.forEach((s: any) => { stMap[s.status] = (stMap[s.status] ?? 0) + 1 })
    setStatusData(Object.entries(stMap).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })))

    // Client data
    const cliMap: Record<string, number> = {}
    subsData.forEach((s: any) => {
      const c = (s.requirements as any)?.clients?.client_name ?? 'Unknown'
      cliMap[c] = (cliMap[c] ?? 0) + 1
    })
    setClientData(Object.entries(cliMap).slice(0, 8).map(([name, count]) => ({ name, count })))

    // Funnel
    const stages = ['sourced', 'submitted', 'shortlisted', 'interview_scheduled', 'offered', 'joined']
    const funnel = stages.map(s => ({ stage: s.replace(/_/g, ' '), count: subsData.filter((sub: any) => sub.status === s).length }))
    setFunnelData(funnel)

    setLoading(false)
  }

  const exportReport = (type: string) => {
    if (type === 'submissions') downloadCSV(allSubmissions, 'submission_report')
    if (type === 'candidates') downloadCSV(allCandidates, 'candidate_report')
    if (type === 'requirements') downloadCSV(allReqs, 'requirement_report')
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">Recruitment performance insights</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 1 year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Export Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => exportReport('submissions')}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Submission Report
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportReport('candidates')}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Candidate Report
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportReport('requirements')}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Requirement Report
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recruiter">Recruiter Performance</TabsTrigger>
          <TabsTrigger value="client">Client Analytics</TabsTrigger>
          <TabsTrigger value="funnel">Candidate Funnel</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Daily Submissions</CardTitle></CardHeader>
              <CardContent>
                {submissionData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data in this period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={submissionData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Status Distribution</CardTitle></CardHeader>
              <CardContent>
                {statusData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data</div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={200}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>
                          {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-1 text-xs">
                      {statusData.map((s, i) => (
                        <div key={s.name} className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-muted-foreground capitalize">{s.name}</span>
                          <span className="ml-1 font-semibold">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recruiter">
          <Card>
            <CardHeader><CardTitle className="text-sm">Submissions by Recruiter</CardTitle></CardHeader>
            <CardContent>
              {recruiterData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data in this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={recruiterData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="client">
          <Card>
            <CardHeader><CardTitle className="text-sm">Submissions by Client</CardTitle></CardHeader>
            <CardContent>
              {clientData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={clientData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel">
          <Card>
            <CardHeader><CardTitle className="text-sm">Candidate Pipeline Funnel</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {funnelData.map((stage, i) => {
                  const max = funnelData[0]?.count || 1
                  const pct = Math.round((stage.count / max) * 100)
                  return (
                    <div key={stage.stage} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground capitalize w-36 text-right">{stage.stage}</span>
                      <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                        <div
                          className="h-full rounded-full flex items-center px-2 text-xs font-semibold text-white transition-all duration-700"
                          style={{ width: `${Math.max(pct, 5)}%`, background: COLORS[i] }}
                        >
                          {stage.count}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground w-10">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
