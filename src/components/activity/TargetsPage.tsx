import React, { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Target, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label, Card, CardContent, CardHeader, CardTitle, Progress } from '@/components/ui/components'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/forms'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/forms'
import { DataTable } from '@/components/ui/data-table'
import { targetsService, profilesService, dashboardService } from '@/lib/services'
import { formatDate } from '@/lib/utils'
import type { Target as TargetType, Profile, RecruiterKPI } from '@/types'
import { type ColumnDef } from '@tanstack/react-table'

const emptyForm = {
  user_id: '', team_id: '', period_type: 'monthly' as const,
  period_start: '', period_end: '',
  target_submissions: '20', target_interviews: '10',
  target_offers: '5', target_joinings: '3',
}

export function TargetsPage() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()
  const [targets, setTargets] = useState<TargetType[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [kpis, setKpis] = useState<RecruiterKPI[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TargetType | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: t }, { data: p }, kpiData] = await Promise.all([
      isAdmin ? targetsService.getAll() : targetsService.getByUser(user!.id),
      profilesService.getApprovedRecruiters(),
      dashboardService.getRecruiterKPIs(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ])
    setTargets(t ?? [])
    setProfiles(p ?? [])
    setKpis(kpiData)
  }

  const handleSave = async () => {
    if (!form.user_id || !form.period_start || !form.period_end) {
      toast({ title: 'Recruiter and period dates are required', variant: 'destructive' }); return
    }
    setSaving(true)
    try {
      const payload = {
        user_id: form.user_id,
        team_id: form.team_id || null,
        period_type: form.period_type,
        period_start: form.period_start,
        period_end: form.period_end,
        target_submissions: Number(form.target_submissions) || 0,
        target_interviews: Number(form.target_interviews) || 0,
        target_offers: Number(form.target_offers) || 0,
        target_joinings: Number(form.target_joinings) || 0,
        created_by: user!.id,
      }
      if (editing) {
        await targetsService.update(editing.id, payload)
        toast({ title: 'Target updated', variant: 'success' })
      } else {
        await targetsService.create(payload as any)
        toast({ title: 'Target created', variant: 'success' })
      }
      setOpen(false)
      fetchAll()
    } finally { setSaving(false) }
  }

  const handleDelete = async (t: TargetType) => {
    if (!confirm('Delete this target?')) return
    await targetsService.delete(t.id)
    toast({ title: 'Target deleted', variant: 'success' })
    fetchAll()
  }

  const columns: ColumnDef<TargetType>[] = [
    {
      id: 'recruiter', header: 'Recruiter',
      cell: ({ row }) => <span className="font-semibold">{(row.original as any).profiles?.full_name ?? '—'}</span>,
    },
    { accessorKey: 'period_type', header: 'Period Type', cell: ({ row }) => <span className="capitalize">{row.original.period_type}</span> },
    { accessorKey: 'period_start', header: 'Start', cell: ({ row }) => formatDate(row.original.period_start) },
    { accessorKey: 'period_end', header: 'End', cell: ({ row }) => formatDate(row.original.period_end) },
    {
      id: 'submissions', header: 'Submissions',
      cell: ({ row }) => {
        const t = row.original
        const pct = t.target_submissions > 0 ? Math.round((t.actual_submissions / t.target_submissions) * 100) : 0
        return (
          <div className="min-w-24">
            <div className="flex justify-between text-xs mb-1">
              <span>{t.actual_submissions}/{t.target_submissions}</span>
              <span className="font-semibold">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        )
      },
    },
    {
      id: 'offers', header: 'Offers',
      cell: ({ row }) => {
        const t = row.original
        const pct = t.target_offers > 0 ? Math.round((t.actual_offers / t.target_offers) * 100) : 0
        return (
          <div className="min-w-20">
            <div className="flex justify-between text-xs mb-1">
              <span>{t.actual_offers}/{t.target_offers}</span>
              <span className="font-semibold">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        )
      },
    },
    {
      id: 'joinings', header: 'Joinings',
      cell: ({ row }) => {
        const t = row.original
        const pct = t.target_joinings > 0 ? Math.round((t.actual_joinings / t.target_joinings) * 100) : 0
        return <span className={`text-sm font-semibold ${pct >= 100 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-destructive'}`}>{t.actual_joinings}/{t.target_joinings}</span>
      },
    },
    {
      id: 'actions', header: 'Actions',
      cell: ({ row }) => isAdmin ? (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
            setEditing(row.original)
            setForm({
              user_id: row.original.user_id, team_id: row.original.team_id ?? '',
              period_type: row.original.period_type as any,
              period_start: row.original.period_start, period_end: row.original.period_end,
              target_submissions: row.original.target_submissions.toString(),
              target_interviews: row.original.target_interviews.toString(),
              target_offers: row.original.target_offers.toString(),
              target_joinings: row.original.target_joinings.toString(),
            })
            setOpen(true)
          }}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(row.original)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Recruiter Targets & KPIs</h1>
          <p className="text-sm text-muted-foreground">Track performance against targets</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Set Target
          </Button>
        )}
      </div>

      {/* KPI Overview */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Last 30 Days — Recruiter Performance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {kpis.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity in last 30 days</p>
          ) : kpis.sort((a, b) => b.submissions - a.submissions).map(kpi => (
            <Card key={kpi.user_id}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {kpi.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{kpi.full_name}</p>
                    <p className="text-xs text-muted-foreground">{kpi.conversion_rate}% conversion</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'Subs', val: kpi.submissions },
                    { label: 'Intv', val: kpi.interviews },
                    { label: 'Offers', val: kpi.offers },
                    { label: 'Joined', val: kpi.joinings },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-muted/50 rounded-lg p-1.5">
                      <p className="text-lg font-bold text-primary">{val}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Targets Table */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Active Targets</h2>
        <DataTable data={targets} columns={columns} searchPlaceholder="Search targets…" />
      </div>

      {/* Target Form */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Target' : 'Set Target'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Recruiter *</Label>
              <Select value={form.user_id} onValueChange={v => setForm(f => ({ ...f, user_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select recruiter" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Period Type</Label>
              <Select value={form.period_type} onValueChange={v => setForm(f => ({ ...f, period_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['daily','weekly','monthly','quarterly','yearly'] as const).map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Period Start *</Label>
                <Input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Period End *</Label>
                <Input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Target Submissions</Label>
                <Input type="number" value={form.target_submissions} onChange={e => setForm(f => ({ ...f, target_submissions: e.target.value }))} min="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Target Interviews</Label>
                <Input type="number" value={form.target_interviews} onChange={e => setForm(f => ({ ...f, target_interviews: e.target.value }))} min="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Target Offers</Label>
                <Input type="number" value={form.target_offers} onChange={e => setForm(f => ({ ...f, target_offers: e.target.value }))} min="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Target Joinings</Label>
                <Input type="number" value={form.target_joinings} onChange={e => setForm(f => ({ ...f, target_joinings: e.target.value }))} min="0" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Target'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
