import React, { useEffect, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, Trash2, Download, FileText, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { logActivity } from '@/lib/activityLogger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label, Textarea } from '@/components/ui/components'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/forms'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/forms'
import { DataTable } from '@/components/ui/data-table'
import { formatDate, formatCTC, downloadCSV, cn, escapeFilterValue, openSignedFile } from '@/lib/utils'

interface Candidate {
  id: string
  candidate_name: string
  mobile_number: string
  email_address: string
  pan_number: string | null
  date_of_birth: string | null
  current_location: string | null
  preferred_location: string | null
  total_experience: number | null
  relevant_experience: number | null
  skills: string[]
  current_employer: string | null
  current_ctc: number | null
  expected_ctc: number | null
  notice_period: number | null
  can_join_within: number | null
  highest_qualification: string | null
  university: string | null
  passing_year: number | null
  resume_url: string | null
  notes: string | null
  created_at: string
}

const emptyForm = {
  candidate_name: '', mobile_number: '', email_address: '',
  pan_number: '', date_of_birth: '', current_location: '', preferred_location: '',
  total_experience: '', relevant_experience: '', skills: '',
  current_employer: '', current_ctc: '', expected_ctc: '',
  notice_period: '', can_join_within: '',
  highest_qualification: '', university: '', passing_year: '', notes: '',
}

export function CandidatesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<Candidate[]>([])
  const [open, setOpen] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [editing, setEditing] = useState<Candidate | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [timeline, setTimeline] = useState<any[]>([])

  useEffect(() => { fetchCandidates() }, [])

  const fetchCandidates = async () => {
    const { data } = await supabase.from('candidates').select('*').order('created_at', { ascending: false })
    setItems(data ?? [])
  }

  const openCreate = () => { setEditing(null); setForm(emptyForm); setResumeFile(null); setOpen(true) }

  const openEdit = (c: Candidate) => {
    setEditing(c)
    setForm({
      candidate_name: c.candidate_name, mobile_number: c.mobile_number,
      email_address: c.email_address, pan_number: c.pan_number ?? '',
      date_of_birth: c.date_of_birth ?? '', current_location: c.current_location ?? '',
      preferred_location: c.preferred_location ?? '',
      total_experience: c.total_experience?.toString() ?? '',
      relevant_experience: c.relevant_experience?.toString() ?? '',
      skills: c.skills.join(', '), current_employer: c.current_employer ?? '',
      current_ctc: c.current_ctc?.toString() ?? '',
      expected_ctc: c.expected_ctc?.toString() ?? '',
      notice_period: c.notice_period?.toString() ?? '',
      can_join_within: c.can_join_within?.toString() ?? '',
      highest_qualification: c.highest_qualification ?? '',
      university: c.university ?? '',
      passing_year: c.passing_year?.toString() ?? '',
      notes: c.notes ?? '',
    })
    setResumeFile(null)
    setOpen(true)
  }

  const openTimeline = async (c: Candidate) => {
    setSelectedCandidate(c)
    const { data } = await supabase
      .from('submissions')
      .select('*, requirements(fg_id, requirement_title)')
      .eq('candidate_id', c.id)
      .order('created_at', { ascending: false })
    setTimeline(data ?? [])
    setTimelineOpen(true)
  }

  const handleSave = async () => {
    if (!form.candidate_name.trim() || !form.mobile_number.trim() || !form.email_address.trim()) {
      toast({ title: 'Name, mobile and email are required', variant: 'destructive' }); return
    }
    // Duplicate detection
    if (!editing) {
      const mobile = escapeFilterValue(form.mobile_number)
      const email = escapeFilterValue(form.email_address)
      const { data: existing } = await supabase
        .from('candidates')
        .select('id, candidate_name')
        .or(`mobile_number.eq.${mobile},email_address.eq.${email}`)
      if (existing && existing.length > 0) {
        toast({ title: 'Duplicate detected', description: `Candidate ${existing[0].candidate_name} already exists with same mobile or email`, variant: 'destructive' })
        return
      }
    }

    setSaving(true)
    try {
      let resume_url = editing?.resume_url ?? null
      if (resumeFile) {
        const path = `${editing?.id ?? 'new'}/${Date.now()}_${resumeFile.name}`
        const { error } = await supabase.storage.from('resumes').upload(path, resumeFile, { upsert: true })
        // Bucket is private — store the storage path; a fresh signed URL is
        // generated on demand whenever the resume is opened (see openSignedFile).
        if (!error) resume_url = path
      }

      const payload = {
        candidate_name: form.candidate_name,
        mobile_number: form.mobile_number,
        email_address: form.email_address,
        pan_number: form.pan_number || null,
        date_of_birth: form.date_of_birth || null,
        current_location: form.current_location || null,
        preferred_location: form.preferred_location || null,
        total_experience: form.total_experience ? Number(form.total_experience) : null,
        relevant_experience: form.relevant_experience ? Number(form.relevant_experience) : null,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        current_employer: form.current_employer || null,
        current_ctc: form.current_ctc ? Number(form.current_ctc) : null,
        expected_ctc: form.expected_ctc ? Number(form.expected_ctc) : null,
        notice_period: form.notice_period ? Number(form.notice_period) : null,
        can_join_within: form.can_join_within ? Number(form.can_join_within) : null,
        highest_qualification: form.highest_qualification || null,
        university: form.university || null,
        passing_year: form.passing_year ? Number(form.passing_year) : null,
        notes: form.notes || null,
        resume_url,
      }

      if (editing) {
        await supabase.from('candidates').update(payload).eq('id', editing.id)
        await logActivity({ module: 'Candidates', action: 'Updated candidate', details: form.candidate_name, recordId: editing.id })
        toast({ title: 'Candidate updated', variant: 'success' })
      } else {
        await supabase.from('candidates').insert({ ...payload, created_by: user!.id })
        await logActivity({ module: 'Candidates', action: 'Added candidate', details: form.candidate_name })
        toast({ title: 'Candidate added', variant: 'success' })
      }
      setOpen(false)
      fetchCandidates()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c: Candidate) => {
    if (!confirm(`Delete candidate "${c.candidate_name}"?`)) return
    await supabase.from('candidates').delete().eq('id', c.id)
    await logActivity({ module: 'Candidates', action: 'Deleted candidate', details: c.candidate_name })
    toast({ title: 'Candidate deleted', variant: 'success' })
    fetchCandidates()
  }

  const columns: ColumnDef<Candidate>[] = [
    {
      accessorKey: 'candidate_name', header: 'Name',
      cell: ({ row }) => <span className="font-semibold">{row.original.candidate_name}</span>,
    },
    { accessorKey: 'mobile_number', header: 'Mobile' },
    { accessorKey: 'email_address', header: 'Email', cell: ({ row }) => <span className="text-xs">{row.original.email_address}</span> },
    { accessorKey: 'current_location', header: 'Location', cell: ({ row }) => row.original.current_location ?? '—' },
    {
      accessorKey: 'total_experience', header: 'Exp (yrs)',
      cell: ({ row }) => row.original.total_experience != null ? `${row.original.total_experience} yrs` : '—',
    },
    { accessorKey: 'current_employer', header: 'Current Employer', cell: ({ row }) => row.original.current_employer ?? '—' },
    { accessorKey: 'current_ctc', header: 'Current CTC', cell: ({ row }) => formatCTC(row.original.current_ctc) },
    { accessorKey: 'expected_ctc', header: 'Expected CTC', cell: ({ row }) => formatCTC(row.original.expected_ctc) },
    {
      accessorKey: 'notice_period', header: 'Notice',
      cell: ({ row }) => row.original.notice_period != null ? `${row.original.notice_period}d` : '—',
    },
    {
      accessorKey: 'skills', header: 'Skills',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1 max-w-48">
          {row.original.skills.slice(0, 2).map(s => (
            <span key={s} className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-xs">{s}</span>
          ))}
          {row.original.skills.length > 2 && <span className="text-xs text-muted-foreground">+{row.original.skills.length - 2}</span>}
        </div>
      ),
    },
    {
      id: 'actions', header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.resume_url && (
            <Button
              variant="ghost" size="icon" className="h-7 w-7" title="Download Resume" aria-label="Download Resume"
              onClick={async () => {
                const { error } = await openSignedFile('resumes', row.original.resume_url!)
                if (error) toast({ title: 'Could not open resume', variant: 'destructive' })
              }}
            >
              <FileText className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Timeline" onClick={() => openTimeline(row.original)}>
            <Clock className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(row.original)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(row.original)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Candidates</h1>
          <p className="text-sm text-muted-foreground">{items.length} candidates in database</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV(items as any[], 'candidates')}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Candidate
          </Button>
        </div>
      </div>

      <DataTable data={items} columns={columns} searchPlaceholder="Search candidates…" />

      {/* Candidate Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Candidate' : 'Add Candidate'}</DialogTitle>
            {!editing && <DialogDescription>Duplicate check: mobile and email must be unique</DialogDescription>}
          </DialogHeader>
          <div className="space-y-4">
            {/* Personal Info */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Personal Information</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Full Name *</Label>
                  <Input value={form.candidate_name} onChange={e => setForm(f => ({ ...f, candidate_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mobile Number *</Label>
                  <Input value={form.mobile_number} onChange={e => setForm(f => ({ ...f, mobile_number: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email Address *</Label>
                  <Input type="email" value={form.email_address} onChange={e => setForm(f => ({ ...f, email_address: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>PAN Number</Label>
                  <Input value={form.pan_number} onChange={e => setForm(f => ({ ...f, pan_number: e.target.value }))} className="mono uppercase" maxLength={10} />
                </div>
                <div className="space-y-1.5">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Current Location</Label>
                  <Input value={form.current_location} onChange={e => setForm(f => ({ ...f, current_location: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Preferred Location</Label>
                  <Input value={form.preferred_location} onChange={e => setForm(f => ({ ...f, preferred_location: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Professional Info */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Professional Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Total Experience (yrs)</Label>
                  <Input type="number" value={form.total_experience} onChange={e => setForm(f => ({ ...f, total_experience: e.target.value }))} min="0" step="0.5" />
                </div>
                <div className="space-y-1.5">
                  <Label>Relevant Experience (yrs)</Label>
                  <Input type="number" value={form.relevant_experience} onChange={e => setForm(f => ({ ...f, relevant_experience: e.target.value }))} min="0" step="0.5" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Skills (comma separated)</Label>
                  <Input value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))} placeholder="Java, Spring Boot, React…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Current Employer</Label>
                  <Input value={form.current_employer} onChange={e => setForm(f => ({ ...f, current_employer: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Current CTC (₹/yr)</Label>
                  <Input type="number" value={form.current_ctc} onChange={e => setForm(f => ({ ...f, current_ctc: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Expected CTC (₹/yr)</Label>
                  <Input type="number" value={form.expected_ctc} onChange={e => setForm(f => ({ ...f, expected_ctc: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Notice Period (days)</Label>
                  <Input type="number" value={form.notice_period} onChange={e => setForm(f => ({ ...f, notice_period: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Can Join Within (days)</Label>
                  <Input type="number" value={form.can_join_within} onChange={e => setForm(f => ({ ...f, can_join_within: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Education */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Education</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Highest Qualification</Label>
                  <Input value={form.highest_qualification} onChange={e => setForm(f => ({ ...f, highest_qualification: e.target.value }))} placeholder="B.Tech, MBA…" />
                </div>
                <div className="space-y-1.5">
                  <Label>University</Label>
                  <Input value={form.university} onChange={e => setForm(f => ({ ...f, university: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Passing Year</Label>
                  <Input type="number" value={form.passing_year} onChange={e => setForm(f => ({ ...f, passing_year: e.target.value }))} min="1990" max="2030" />
                </div>
              </div>
            </div>

            {/* Resume */}
            <div className="space-y-1.5">
              <Label>Resume (PDF/DOCX)</Label>
              <Input type="file" accept=".pdf,.docx,.doc" onChange={e => setResumeFile(e.target.files?.[0] ?? null)} />
              {editing?.resume_url && !resumeFile && (
                <p className="text-xs text-muted-foreground">
                  Current:{' '}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={async () => {
                      const { error } = await openSignedFile('resumes', editing.resume_url!)
                      if (error) toast({ title: 'Could not open resume', variant: 'destructive' })
                    }}
                  >
                    View Resume
                  </button>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Candidate'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timeline Dialog */}
      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Timeline — {selectedCandidate?.candidate_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No submissions yet</p>
            ) : (
              timeline.map((sub, i) => (
                <div key={sub.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1 flex-shrink-0" />
                    {i < timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm font-medium">{sub.requirements?.requirement_title}</p>
                    <p className="text-xs text-muted-foreground mono">{sub.requirements?.fg_id}</p>
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold mt-1", `badge-${sub.status.replace(/_/g, '-')}`)}>
                      {sub.status.replace(/_/g, ' ')}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(sub.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
