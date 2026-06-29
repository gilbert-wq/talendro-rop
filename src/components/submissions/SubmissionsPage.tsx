import React, { useEffect, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, Download, Filter } from 'lucide-react'
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
import { formatDate, formatCTC, getStatusBadgeClass, downloadCSV, cn } from '@/lib/utils'

const STATUSES = [
  { value: 'sourced', label: 'Sourced' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interview_scheduled', label: 'Interview Scheduled' },
  { value: 'l1_cleared', label: 'L1 Cleared' },
  { value: 'l2_cleared', label: 'L2 Cleared' },
  { value: 'final_round', label: 'Final Round' },
  { value: 'offered', label: 'Offered' },
  { value: 'joined', label: 'Joined' },
  { value: 'rejected', label: 'Rejected' },
]

interface Submission {
  id: string
  submission_date: string
  requirement_id: string
  candidate_id: string
  vendor_id: string | null
  partner_name: string | null
  status: string
  notes: string | null
  submitted_by: string
  created_at: string
  candidates?: { candidate_name: string; mobile_number: string; email_address: string; current_location: string | null; total_experience: number | null; notice_period: number | null; current_ctc: number | null; expected_ctc: number | null; pan_number: string | null; date_of_birth: string | null; highest_qualification: string | null; university: string | null; passing_year: number | null; current_employer: string | null; can_join_within: number | null; preferred_location: string | null; skills: string[] }
  requirements?: { fg_id: string; requirement_title: string; clients?: { client_name: string } | null }
  vendors?: { vendor_name: string } | null
}

interface Requirement { id: string; fg_id: string; requirement_title: string }
interface Candidate { id: string; candidate_name: string; mobile_number: string }
interface Vendor { id: string; vendor_name: string }

const emptyForm = {
  submission_date: new Date().toISOString().split('T')[0],
  requirement_id: '', candidate_id: '', vendor_id: '', partner_name: '', status: 'sourced', notes: '',
}

export function SubmissionsPage() {
  const { user, isLeadership } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<Submission[]>([])
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Submission | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => { fetchAll() }, [])

  const SUBMISSIONS_SELECT_WITH_VENDOR = '*, candidates(*), requirements(fg_id, requirement_title, clients(client_name)), vendors(vendor_name)'
  const SUBMISSIONS_SELECT_NO_VENDOR = '*, candidates(*), requirements(fg_id, requirement_title, clients(client_name))'

  const fetchAll = async () => {
    let subsRes = await supabase.from('submissions').select(SUBMISSIONS_SELECT_WITH_VENDOR).order('submission_date', { ascending: false })

    if (subsRes.error) {
      // This most commonly means PostgREST's schema cache hasn't picked up
      // the submissions.vendor_id -> vendors.id foreign key yet (a known
      // Supabase gotcha after running a migration via the SQL editor — it
      // usually needs `NOTIFY pgrst, 'reload schema';` or a brief wait).
      // Rather than showing "No records found" with no explanation
      // (the previous behavior), retry without the vendors embed so real
      // data still loads, and surface a specific, actionable warning.
      const fallback = await supabase.from('submissions').select(SUBMISSIONS_SELECT_NO_VENDOR).order('submission_date', { ascending: false })
      if (fallback.error) {
        toast({ title: 'Could not load submissions', description: fallback.error.message, variant: 'destructive' })
      } else {
        toast({
          title: 'Vendor names temporarily unavailable',
          description: "Run NOTIFY pgrst, 'reload schema'; in the Supabase SQL editor to fix this.",
          variant: 'destructive',
        })
      }
      subsRes = fallback
    }

    const [reqsRes, candsRes, vendsRes] = await Promise.all([
      supabase.from('requirements').select('id, fg_id, requirement_title').eq('status', 'open'),
      supabase.from('candidates').select('id, candidate_name, mobile_number'),
      supabase.from('vendors').select('id, vendor_name').eq('status', 'active').order('vendor_name'),
    ])
    setItems(subsRes.data ?? [])
    setRequirements(reqsRes.data ?? [])
    setCandidates(candsRes.data ?? [])
    setVendors(vendsRes.data ?? [])
  }

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true) }
  const openEdit = (s: Submission) => {
    setEditing(s)
    setForm({
      submission_date: s.submission_date, requirement_id: s.requirement_id,
      candidate_id: s.candidate_id, vendor_id: s.vendor_id ?? '', partner_name: s.partner_name ?? '',
      status: s.status, notes: s.notes ?? '',
    })
    setOpen(true)
  }

  const handleSave = async () => {
    if (!form.requirement_id || !form.candidate_id) {
      toast({ title: 'Requirement and Candidate are required', variant: 'destructive' }); return
    }
    setSaving(true)
    try {
      // SECURITY: partner_name is plain text on the submissions row, which
      // recruiters can read (submissions_select is is_approved_user()).
      // Previously this auto-copied the selected vendor's name into it,
      // which leaked the vendor's identity right back around the new
      // leadership-only vendors RLS. partner_name is now only ever the
      // free-text fallback a leadership user types when no formal vendor
      // record is selected — never a denormalized copy of vendor_name.
      const payload = {
        ...form,
        vendor_id: form.vendor_id || null,
        partner_name: form.vendor_id ? null : (form.partner_name || null),
      }
      if (editing) {
        await supabase.from('submissions').update(payload).eq('id', editing.id)
        await logActivity({ module: 'Submissions', action: 'Updated submission status', details: form.status, recordId: editing.id })
        toast({ title: 'Submission updated', variant: 'success' })
      } else {
        // Check for duplicate submission
        const { data: existing } = await supabase.from('submissions')
          .select('id').eq('requirement_id', form.requirement_id).eq('candidate_id', form.candidate_id)
        if (existing && existing.length > 0) {
          toast({ title: 'Duplicate submission', description: 'This candidate is already submitted for this requirement', variant: 'destructive' })
          setSaving(false); return
        }
        await supabase.from('submissions').insert({ ...payload, submitted_by: user!.id })
        // Create notification
        await supabase.from('notifications').insert({
          user_id: user!.id, title: 'New Submission',
          message: `Candidate submitted successfully`,
          type: 'success', read: false,
        })
        await logActivity({ module: 'Submissions', action: 'Created submission', details: `${form.status}` })
        toast({ title: 'Submission created', variant: 'success' })
      }
      setOpen(false)
      fetchAll()
    } finally {
      setSaving(false)
    }
  }

  const filtered = filterStatus === 'all' ? items : items.filter(s => s.status === filterStatus)

  const exportData = filtered.map(s => ({
    'Submission Date': s.submission_date,
    'FG ID': s.requirements?.fg_id ?? '',
    'Position': s.requirements?.requirement_title ?? '',
    ...(isLeadership ? {
      'Client': (s.requirements as any)?.clients?.client_name ?? '',
      'Partner': s.partner_name ?? '',
      'Vendor': s.vendors?.vendor_name ?? '',
    } : {}),
    'Candidate Name': s.candidates?.candidate_name ?? '',
    'Contact': s.candidates?.mobile_number ?? '',
    'Email': s.candidates?.email_address ?? '',
    'Experience': s.candidates?.total_experience ?? '',
    'Current Location': s.candidates?.current_location ?? '',
    'Preferred Location': s.candidates?.preferred_location ?? '',
    'Notice Period': s.candidates?.notice_period ?? '',
    'Can Join Within': s.candidates?.can_join_within ?? '',
    'PAN': s.candidates?.pan_number ?? '',
    'DOB': s.candidates?.date_of_birth ?? '',
    'Education': s.candidates?.highest_qualification ?? '',
    'University': s.candidates?.university ?? '',
    'Year of Passing': s.candidates?.passing_year ?? '',
    'Current Employer': s.candidates?.current_employer ?? '',
    'Current CTC': s.candidates?.current_ctc ?? '',
    'Expected CTC': s.candidates?.expected_ctc ?? '',
    'Skills': (s.candidates?.skills ?? []).join(', '),
    'Status': s.status,
    'Notes': s.notes ?? '',
  }))

  const columns: ColumnDef<Submission>[] = [
    { accessorKey: 'submission_date', header: 'Date', cell: ({ row }) => formatDate(row.original.submission_date) },
    {
      id: 'fg_id', header: 'FG ID',
      cell: ({ row }) => <span className="mono text-xs font-semibold text-primary">{row.original.requirements?.fg_id}</span>,
    },
    {
      id: 'position', header: 'Position',
      cell: ({ row }) => <span className="text-xs">{row.original.requirements?.requirement_title}</span>,
    },
    // Client and Vendor columns are leadership-only — recruiters lose both
    // client portfolio visibility and vendor details (name/contact info)
    // per the access-control changes above. Spreading an empty array when
    // not leadership keeps these columns out entirely rather than showing
    // a column full of "—" (which RLS would produce anyway, but an absent
    // column reads cleaner than a uniformly blank one).
    ...(isLeadership ? [
      {
        id: 'client', header: 'Client',
        cell: ({ row }: any) => (row.original.requirements as any)?.clients?.client_name ?? '—',
      },
      {
        id: 'vendor', header: 'Vendor',
        cell: ({ row }: any) => row.original.vendors?.vendor_name ?? row.original.partner_name ?? '—',
      },
    ] as ColumnDef<Submission>[] : []),
    {
      id: 'candidate_name', header: 'Candidate',
      cell: ({ row }) => <span className="font-semibold">{row.original.candidates?.candidate_name}</span>,
    },
    {
      id: 'mobile', header: 'Contact',
      cell: ({ row }) => row.original.candidates?.mobile_number,
    },
    {
      id: 'experience', header: 'Exp',
      cell: ({ row }) => row.original.candidates?.total_experience != null ? `${row.original.candidates.total_experience}y` : '—',
    },
    {
      id: 'location', header: 'Location',
      cell: ({ row }) => row.original.candidates?.current_location ?? '—',
    },
    {
      id: 'notice', header: 'Notice',
      cell: ({ row }) => row.original.candidates?.notice_period != null ? `${row.original.candidates.notice_period}d` : '—',
    },
    {
      id: 'current_ctc', header: 'Curr CTC',
      cell: ({ row }) => formatCTC(row.original.candidates?.current_ctc),
    },
    {
      id: 'expected_ctc', header: 'Exp CTC',
      cell: ({ row }) => formatCTC(row.original.candidates?.expected_ctc),
    },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => (
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", getStatusBadgeClass(row.original.status))}>
          {STATUSES.find(s => s.value === row.original.status)?.label ?? row.original.status}
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

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Submission Tracker</h1>
          <p className="text-sm text-muted-foreground">{items.length} submissions</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Filter status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => downloadCSV(exportData, 'submission_tracker')}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export Tracker
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Submission
          </Button>
        </div>
      </div>

      <DataTable data={filtered} columns={columns} searchPlaceholder="Search submissions…" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Update Submission' : 'New Submission'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Submission Date</Label>
              <Input type="date" value={form.submission_date} onChange={e => setForm(f => ({ ...f, submission_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Requirement *</Label>
              <Select value={form.requirement_id} onValueChange={v => setForm(f => ({ ...f, requirement_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select requirement" /></SelectTrigger>
                <SelectContent>
                  {requirements.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.fg_id} — {r.requirement_title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Candidate *</Label>
              <Select value={form.candidate_id} onValueChange={v => setForm(f => ({ ...f, candidate_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select candidate" /></SelectTrigger>
                <SelectContent>
                  {candidates.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.candidate_name} — {c.mobile_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isLeadership && (
              <>
                <div className="space-y-1.5">
                  <Label>Vendor / Staffing Partner</Label>
                  <Select value={form.vendor_id || 'none'} onValueChange={v => setForm(f => ({ ...f, vendor_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select vendor (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (direct sourcing)</SelectItem>
                      {vendors.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Partner Name (free text, used if no vendor selected)</Label>
                  <Input value={form.partner_name} onChange={e => setForm(f => ({ ...f, partner_name: e.target.value }))} placeholder="Partner company name" disabled={!!form.vendor_id} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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
