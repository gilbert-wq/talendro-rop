import React, { useEffect, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { logActivity } from '@/lib/activityLogger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label, Textarea } from '@/components/ui/components'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/forms'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/forms'
import { DataTable } from '@/components/ui/data-table'
import { formatDate, getStatusBadgeClass, downloadCSV, cn } from '@/lib/utils'

interface Interview {
  id: string
  submission_id: string
  candidate_id: string
  requirement_id: string
  interview_date: string
  interview_time: string | null
  interview_round: string
  interviewer: string | null
  feedback: string | null
  result: string
  created_at: string
  candidates?: { candidate_name: string; mobile_number: string }
  requirements?: { fg_id: string; requirement_title: string }
}

const ROUNDS = ['L1', 'L2', 'L3', 'HR', 'Technical', 'Manager', 'Final']
const RESULTS = [
  { value: 'pending', label: 'Pending' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'on_hold', label: 'On Hold' },
]

const emptyForm = {
  submission_id: '', candidate_id: '', requirement_id: '',
  interview_date: '', interview_time: '', interview_round: 'L1',
  interviewer: '', feedback: '', result: 'pending',
}

export function InterviewsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<Interview[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Interview | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: ivs }, { data: subs }] = await Promise.all([
      supabase.from('interviews').select('*, candidates(candidate_name, mobile_number), requirements(fg_id, requirement_title)').order('interview_date', { ascending: false }),
      supabase.from('submissions').select('id, candidate_id, requirement_id, candidates(candidate_name), requirements(fg_id, requirement_title)'),
    ])
    setItems(ivs ?? [])
    setSubmissions(subs ?? [])
  }

  const handleSubSelect = (subId: string) => {
    const sub = submissions.find(s => s.id === subId)
    if (sub) {
      setForm(f => ({ ...f, submission_id: subId, candidate_id: sub.candidate_id, requirement_id: sub.requirement_id }))
    }
  }

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true) }
  const openEdit = (iv: Interview) => {
    setEditing(iv)
    setForm({
      submission_id: iv.submission_id, candidate_id: iv.candidate_id,
      requirement_id: iv.requirement_id,
      interview_date: iv.interview_date, interview_time: iv.interview_time ?? '',
      interview_round: iv.interview_round, interviewer: iv.interviewer ?? '',
      feedback: iv.feedback ?? '', result: iv.result,
    })
    setOpen(true)
  }

  const handleSave = async () => {
    if (!form.candidate_id || !form.interview_date) {
      toast({ title: 'Submission and date are required', variant: 'destructive' }); return
    }
    setSaving(true)
    try {
      const payload = {
        submission_id: form.submission_id, candidate_id: form.candidate_id,
        requirement_id: form.requirement_id,
        interview_date: form.interview_date,
        interview_time: form.interview_time || null,
        interview_round: form.interview_round,
        interviewer: form.interviewer || null,
        feedback: form.feedback || null,
        result: form.result,
      }
      if (editing) {
        await supabase.from('interviews').update(payload).eq('id', editing.id)
        // If cleared, update submission status
        if (form.result === 'cleared') {
          await supabase.from('submissions').update({ status: form.interview_round === 'L1' ? 'l1_cleared' : form.interview_round === 'L2' ? 'l2_cleared' : 'final_round' }).eq('id', form.submission_id)
        } else if (form.result === 'rejected') {
          await supabase.from('submissions').update({ status: 'rejected' }).eq('id', form.submission_id)
        }
        await logActivity({ module: 'Interviews', action: 'Updated interview', details: `${form.interview_round} - ${form.result}`, recordId: editing.id })
        toast({ title: 'Interview updated', variant: 'success' })
      } else {
        await supabase.from('interviews').insert({ ...payload, created_by: user!.id })
        await supabase.from('submissions').update({ status: 'interview_scheduled' }).eq('id', form.submission_id)
        await logActivity({ module: 'Interviews', action: 'Scheduled interview', details: form.interview_round })
        toast({ title: 'Interview scheduled', variant: 'success' })
      }
      setOpen(false)
      fetchAll()
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnDef<Interview>[] = [
    { accessorKey: 'interview_date', header: 'Date', cell: ({ row }) => formatDate(row.original.interview_date) },
    { accessorKey: 'interview_time', header: 'Time', cell: ({ row }) => row.original.interview_time ?? '—' },
    {
      id: 'candidate', header: 'Candidate',
      cell: ({ row }) => <span className="font-semibold">{row.original.candidates?.candidate_name}</span>,
    },
    {
      id: 'fg_id', header: 'FG ID',
      cell: ({ row }) => <span className="mono text-xs text-primary">{row.original.requirements?.fg_id}</span>,
    },
    {
      id: 'position', header: 'Position',
      cell: ({ row }) => <span className="text-xs">{row.original.requirements?.requirement_title}</span>,
    },
    { accessorKey: 'interview_round', header: 'Round', cell: ({ row }) => <span className="font-semibold">{row.original.interview_round}</span> },
    { accessorKey: 'interviewer', header: 'Interviewer', cell: ({ row }) => row.original.interviewer ?? '—' },
    {
      accessorKey: 'result', header: 'Result',
      cell: ({ row }) => (
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", getStatusBadgeClass(row.original.result))}>
          {RESULTS.find(r => r.value === row.original.result)?.label ?? row.original.result}
        </span>
      ),
    },
    { accessorKey: 'feedback', header: 'Feedback', cell: ({ row }) => <span className="text-xs line-clamp-1 max-w-40">{row.original.feedback ?? '—'}</span> },
    {
      id: 'actions', header: 'Actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(row.original)}>
          <Edit className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Interview Management</h1>
          <p className="text-sm text-muted-foreground">{items.length} interviews</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV(items as any[], 'interviews')}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Schedule Interview
          </Button>
        </div>
      </div>

      <DataTable data={items} columns={columns} searchPlaceholder="Search interviews…" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Update Interview' : 'Schedule Interview'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Submission (Candidate → Requirement)</Label>
              <Select value={form.submission_id} onValueChange={handleSubSelect}>
                <SelectTrigger><SelectValue placeholder="Select submission" /></SelectTrigger>
                <SelectContent>
                  {submissions.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.candidates?.candidate_name} → {s.requirements?.fg_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Interview Date *</Label>
                <Input type="date" value={form.interview_date} onChange={e => setForm(f => ({ ...f, interview_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Interview Time</Label>
                <Input type="time" value={form.interview_time} onChange={e => setForm(f => ({ ...f, interview_time: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Round</Label>
                <Select value={form.interview_round} onValueChange={v => setForm(f => ({ ...f, interview_round: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROUNDS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Interviewer</Label>
                <Input value={form.interviewer} onChange={e => setForm(f => ({ ...f, interviewer: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Result</Label>
              <Select value={form.result} onValueChange={v => setForm(f => ({ ...f, result: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESULTS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Feedback</Label>
              <Textarea value={form.feedback} onChange={e => setForm(f => ({ ...f, feedback: e.target.value }))} rows={3} placeholder="Interview feedback…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
