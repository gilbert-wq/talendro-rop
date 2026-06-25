import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { logActivity } from '@/lib/activityLogger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label, Textarea } from '@/components/ui/components'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/forms'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/forms'

export interface Interview {
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
}

export const ROUNDS = ['L1', 'L2', 'L3', 'HR', 'Technical', 'Manager', 'Final']
export const RESULTS = [
  { value: 'pending', label: 'Pending' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'on_hold', label: 'On Hold' },
]

interface InterviewFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  submissionId: string
  candidateId: string
  requirementId: string
  editing?: Interview | null
  onSaved: () => void
}

/** Extracted from the now-removed standalone Interviews page so interview
 * scheduling/logging happens contextually from a candidate's card inside
 * the per-requirement pipeline instead of a separate global page. Unlike
 * the original, this never needs a submission picker — the submission is
 * always already known from where this dialog is opened. */
export function InterviewFormDialog({ open, onOpenChange, submissionId, candidateId, requirementId, editing, onSaved }: InterviewFormDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = useState({
    interview_date: '', interview_time: '', interview_round: 'L1',
    interviewer: '', feedback: '', result: 'pending',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setForm({
        interview_date: editing.interview_date, interview_time: editing.interview_time ?? '',
        interview_round: editing.interview_round, interviewer: editing.interviewer ?? '',
        feedback: editing.feedback ?? '', result: editing.result,
      })
    } else if (open) {
      setForm({ interview_date: '', interview_time: '', interview_round: 'L1', interviewer: '', feedback: '', result: 'pending' })
    }
  }, [editing, open])

  const handleSave = async () => {
    if (!form.interview_date) {
      toast({ title: 'Interview date is required', variant: 'destructive' }); return
    }
    setSaving(true)
    try {
      const payload = {
        submission_id: submissionId, candidate_id: candidateId, requirement_id: requirementId,
        interview_date: form.interview_date,
        interview_time: form.interview_time || null,
        interview_round: form.interview_round,
        interviewer: form.interviewer || null,
        feedback: form.feedback || null,
        result: form.result,
      }
      if (editing) {
        await supabase.from('interviews').update(payload).eq('id', editing.id)
        if (form.result === 'cleared') {
          await supabase.from('submissions').update({ status: form.interview_round === 'L1' ? 'l1_cleared' : form.interview_round === 'L2' ? 'l2_cleared' : 'final_round' }).eq('id', submissionId)
        } else if (form.result === 'rejected') {
          await supabase.from('submissions').update({ status: 'rejected' }).eq('id', submissionId)
        }
        await logActivity({ module: 'Interviews', action: 'Updated interview', details: `${form.interview_round} - ${form.result}`, recordId: editing.id })
        toast({ title: 'Interview updated', variant: 'success' })
      } else {
        await supabase.from('interviews').insert({ ...payload, created_by: user!.id })
        await supabase.from('submissions').update({ status: 'interview_scheduled' }).eq('id', submissionId)
        await logActivity({ module: 'Interviews', action: 'Scheduled interview', details: form.interview_round })
        toast({ title: 'Interview scheduled', variant: 'success' })
      }
      onOpenChange(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Update Interview' : 'Schedule Interview'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
