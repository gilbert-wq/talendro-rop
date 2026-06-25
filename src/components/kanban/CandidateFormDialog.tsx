import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { logActivity } from '@/lib/activityLogger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label, Textarea } from '@/components/ui/components'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/forms'
import { escapeFilterValue, openSignedFile } from '@/lib/utils'

export interface Candidate {
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

interface CandidateFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Candidate | null
  /** When set and this is a brand-new candidate (not editing), a submission
   * linking the new candidate to this requirement is created automatically
   * right after the candidate record itself — this is what powers
   * "+ Add Candidate" inside the per-requirement pipeline. */
  requirementId?: string
  onSaved: (candidate: Candidate) => void
}

/** Extracted from the now-removed standalone Candidates page. Reused both
 * for editing an existing candidate (from CandidateDetailDialog) and for
 * creating a brand-new one scoped to a requirement (from
 * RequirementPipelineDialog's "+ Add Candidate" flow). */
export function CandidateFormDialog({ open, onOpenChange, editing, requirementId, onSaved }: CandidateFormDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        candidate_name: editing.candidate_name, mobile_number: editing.mobile_number,
        email_address: editing.email_address, pan_number: editing.pan_number ?? '',
        date_of_birth: editing.date_of_birth ?? '', current_location: editing.current_location ?? '',
        preferred_location: editing.preferred_location ?? '',
        total_experience: editing.total_experience?.toString() ?? '',
        relevant_experience: editing.relevant_experience?.toString() ?? '',
        skills: editing.skills.join(', '), current_employer: editing.current_employer ?? '',
        current_ctc: editing.current_ctc?.toString() ?? '',
        expected_ctc: editing.expected_ctc?.toString() ?? '',
        notice_period: editing.notice_period?.toString() ?? '',
        can_join_within: editing.can_join_within?.toString() ?? '',
        highest_qualification: editing.highest_qualification ?? '',
        university: editing.university ?? '',
        passing_year: editing.passing_year?.toString() ?? '',
        notes: editing.notes ?? '',
      })
    } else {
      setForm(emptyForm)
    }
    setResumeFile(null)
  }, [editing, open])

  const handleSave = async () => {
    if (!form.candidate_name.trim() || !form.mobile_number.trim() || !form.email_address.trim()) {
      toast({ title: 'Name, mobile and email are required', variant: 'destructive' }); return
    }
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
        await logActivity({ module: 'Candidates', action: 'Updated candidate', details: form.candidate_name, recordId: editing.id, activityType: 'candidate_updated' })
        toast({ title: 'Candidate updated', variant: 'success' })
        onSaved({ ...editing, ...payload })
      } else {
        const { data: created, error } = await supabase.from('candidates').insert({ ...payload, created_by: user!.id }).select().single()
        if (error || !created) throw error ?? new Error('Could not create candidate')
        await logActivity({ module: 'Candidates', action: 'Added candidate', details: form.candidate_name, activityType: 'candidate_added' })

        if (requirementId) {
          const { error: subError } = await supabase.from('submissions').insert({
            requirement_id: requirementId, candidate_id: created.id,
            status: 'sourced', submitted_by: user!.id,
          })
          if (subError) {
            toast({ title: 'Candidate added, but could not add to this pipeline', description: subError.message, variant: 'destructive' })
          } else {
            toast({ title: 'Candidate added to pipeline', variant: 'success' })
          }
        } else {
          toast({ title: 'Candidate added', variant: 'success' })
        }
        onSaved(created)
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Candidate' : 'Add Candidate'}</DialogTitle>
          {!editing && <DialogDescription>Duplicate check: mobile and email must be unique</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4">
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Candidate'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
