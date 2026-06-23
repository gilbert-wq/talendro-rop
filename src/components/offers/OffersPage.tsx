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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/forms'
import { DataTable } from '@/components/ui/data-table'
import { formatDate, formatCTC, getStatusBadgeClass, downloadCSV, cn } from '@/lib/utils'

interface Offer {
  id: string
  submission_id: string
  candidate_id: string
  requirement_id: string
  offer_date: string | null
  offered_ctc: number | null
  joining_date: string | null
  joined_date: string | null
  status: string
  notes: string | null
  created_at: string
  candidates?: { candidate_name: string; mobile_number: string; email_address: string }
  requirements?: { fg_id: string; requirement_title: string }
}

const OFFER_STATUSES = [
  { value: 'offered', label: 'Offered' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'joined', label: 'Joined' },
  { value: 'no_show', label: 'No Show' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'backed_out', label: 'Backed Out' },
  { value: 'absconded', label: 'Absconded' },
]

// Statuses that represent the offer is still "live" — i.e. the candidate
// hasn't joined yet but also hasn't been marked as a lost cause. Used to
// compute the aging/at-risk buckets below.
const PENDING_STATUSES = ['offered', 'accepted', 'deferred']

/** Days between the tentative joining_date and today, for offers still
 * pending. Negative/null means not yet due or already resolved. */
function daysOverdue(offer: Offer): number | null {
  if (!PENDING_STATUSES.includes(offer.status) || !offer.joining_date) return null
  const due = new Date(offer.joining_date)
  const today = new Date()
  due.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - due.getTime()) / 86_400_000)
  return diff > 0 ? diff : null
}

function agingBucket(days: number): '15' | '30' | '45' | '90' | null {
  if (days >= 90) return '90'
  if (days >= 45) return '45'
  if (days >= 30) return '30'
  if (days >= 15) return '15'
  return null
}

const emptyForm = {
  submission_id: '', candidate_id: '', requirement_id: '',
  offer_date: '', offered_ctc: '', joining_date: '', joined_date: '', status: 'offered', notes: '',
}

export function OffersPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [offers, setOffers] = useState<Offer[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Offer | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: offs }, { data: subs }] = await Promise.all([
      supabase.from('offers').select('*, candidates(candidate_name, mobile_number, email_address), requirements(fg_id, requirement_title)').order('created_at', { ascending: false }),
      supabase.from('submissions').select('id, candidate_id, requirement_id, candidates(candidate_name), requirements(fg_id, requirement_title)'),
    ])
    setOffers(offs ?? [])
    setSubmissions(subs ?? [])
  }

  const handleSubSelect = (subId: string) => {
    const sub = submissions.find(s => s.id === subId)
    if (sub) setForm(f => ({ ...f, submission_id: subId, candidate_id: sub.candidate_id, requirement_id: sub.requirement_id }))
  }

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true) }
  const openEdit = (o: Offer) => {
    setEditing(o)
    setForm({
      submission_id: o.submission_id, candidate_id: o.candidate_id,
      requirement_id: o.requirement_id,
      offer_date: o.offer_date ?? '', offered_ctc: o.offered_ctc?.toString() ?? '',
      joining_date: o.joining_date ?? '', joined_date: o.joined_date ?? '', status: o.status, notes: o.notes ?? '',
    })
    setOpen(true)
  }

  const handleSave = async () => {
    if (!form.candidate_id) { toast({ title: 'Submission is required', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const payload = {
        submission_id: form.submission_id, candidate_id: form.candidate_id,
        requirement_id: form.requirement_id,
        offer_date: form.offer_date || null,
        offered_ctc: form.offered_ctc ? Number(form.offered_ctc) : null,
        joining_date: form.joining_date || null,
        // If marking as joined and no actual joined_date was entered,
        // default it to today rather than leaving it null.
        joined_date: form.status === 'joined' ? (form.joined_date || new Date().toISOString().split('T')[0]) : (form.joined_date || null),
        status: form.status,
        notes: form.notes || null,
      }
      if (editing) {
        await supabase.from('offers').update(payload).eq('id', editing.id)
        // Sync submission status so the Kanban/Submissions views stay
        // consistent with the outcome recorded here.
        if (form.status === 'offered') await supabase.from('submissions').update({ status: 'offered' }).eq('id', form.submission_id)
        else if (form.status === 'joined') await supabase.from('submissions').update({ status: 'joined' }).eq('id', form.submission_id)
        else if (['declined', 'no_show', 'backed_out', 'absconded'].includes(form.status)) {
          await supabase.from('submissions').update({ status: 'rejected' }).eq('id', form.submission_id)
        }
        await logActivity({
          module: 'Offers', action: 'Updated offer', details: form.status, recordId: editing.id,
          activityType: form.status === 'joined' ? 'candidate_joined' : 'offer_updated',
        })
        toast({ title: 'Offer updated', variant: 'success' })
      } else {
        await supabase.from('offers').insert({ ...payload, created_by: user!.id })
        await supabase.from('submissions').update({ status: 'offered' }).eq('id', form.submission_id)
        await logActivity({ module: 'Offers', action: 'Created offer', details: formatCTC(Number(form.offered_ctc)), activityType: 'offer_released' })
        toast({ title: 'Offer created', variant: 'success' })
      }
      setOpen(false)
      fetchAll()
    } finally {
      setSaving(false)
    }
  }

  const offerColumns: ColumnDef<Offer>[] = [
    { accessorKey: 'offer_date', header: 'Offer Date', cell: ({ row }) => formatDate(row.original.offer_date) },
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
    { accessorKey: 'offered_ctc', header: 'Offered CTC', cell: ({ row }) => formatCTC(row.original.offered_ctc) },
    { accessorKey: 'joining_date', header: 'Tentative Joining', cell: ({ row }) => formatDate(row.original.joining_date) },
    { accessorKey: 'joined_date', header: 'Actual Joined', cell: ({ row }) => row.original.joined_date ? formatDate(row.original.joined_date) : '—' },
    {
      id: 'aging', header: 'Joining Status',
      cell: ({ row }) => {
        const days = daysOverdue(row.original)
        if (row.original.status === 'joined') return <span className="text-emerald-600 text-xs font-medium">✓ Joined</span>
        if (days == null) return <span className="text-xs text-muted-foreground">On track</span>
        const bucket = agingBucket(days)
        const color = bucket === '90' ? 'text-red-700 bg-red-100' : bucket === '45' ? 'text-red-600 bg-red-50' : bucket === '30' ? 'text-amber-700 bg-amber-100' : 'text-amber-600 bg-amber-50'
        return <span className={cn("text-xs font-semibold rounded-full px-2 py-0.5", color)}>{days}d overdue</span>
      },
    },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => (
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", getStatusBadgeClass(row.original.status))}>
          {OFFER_STATUSES.find(s => s.value === row.original.status)?.label ?? row.original.status}
        </span>
      ),
    },
    {
      id: 'actions', header: 'Actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(row.original)}>
          <Edit className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  const joinings = offers.filter(o => o.status === 'joined')
  const pending = offers.filter(o => o.status !== 'joined')
  const atRisk = offers.filter(o => daysOverdue(o) != null)
  const bucketCounts = { '15': 0, '30': 0, '45': 0, '90': 0 } as Record<'15' | '30' | '45' | '90', number>
  atRisk.forEach(o => {
    const days = daysOverdue(o)
    if (days == null) return
    const b = agingBucket(days)
    if (b) bucketCounts[b]++
  })

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Offers & Joinings</h1>
          <p className="text-sm text-muted-foreground">{offers.length} offers · {joinings.length} joined</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV(offers as any[], 'offers')}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Offer
          </Button>
        </div>
      </div>

      {atRisk.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-3">
            <p className="text-lg font-bold text-amber-700">{bucketCounts['15']}</p>
            <p className="text-[11px] text-muted-foreground">15+ days overdue</p>
          </div>
          <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-3">
            <p className="text-lg font-bold text-amber-700">{bucketCounts['30']}</p>
            <p className="text-[11px] text-muted-foreground">30+ days overdue</p>
          </div>
          <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 p-3">
            <p className="text-lg font-bold text-red-600">{bucketCounts['45']}</p>
            <p className="text-[11px] text-muted-foreground">45+ days overdue</p>
          </div>
          <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 p-3">
            <p className="text-lg font-bold text-red-700">{bucketCounts['90']}</p>
            <p className="text-[11px] text-muted-foreground">90+ days overdue</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Offers ({offers.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="atrisk">At Risk ({atRisk.length})</TabsTrigger>
          <TabsTrigger value="joined">Joined ({joinings.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <DataTable data={offers} columns={offerColumns} searchPlaceholder="Search offers…" />
        </TabsContent>
        <TabsContent value="pending">
          <DataTable data={pending} columns={offerColumns} searchPlaceholder="Search…" />
        </TabsContent>
        <TabsContent value="atrisk">
          <p className="text-xs text-muted-foreground mb-2">
            Offers past their tentative joining date with no confirmed join — use this to follow up on candidates who may have backed out or gone silent.
          </p>
          <DataTable data={atRisk} columns={offerColumns} searchPlaceholder="Search…" />
        </TabsContent>
        <TabsContent value="joined">
          <DataTable data={joinings} columns={offerColumns} searchPlaceholder="Search joined…" />
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Update Offer' : 'Add Offer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Submission *</Label>
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
                <Label>Offer Date</Label>
                <Input type="date" value={form.offer_date} onChange={e => setForm(f => ({ ...f, offer_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Offered CTC (₹/yr)</Label>
                <Input type="number" value={form.offered_ctc} onChange={e => setForm(f => ({ ...f, offered_ctc: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tentative Joining Date</Label>
                <Input type="date" value={form.joining_date} onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Actual Joined Date</Label>
                <Input type="date" value={form.joined_date} onChange={e => setForm(f => ({ ...f, joined_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OFFER_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
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
