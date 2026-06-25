import React, { useEffect, useState } from 'react'
import { Edit, FileText, CalendarPlus, MapPin, Briefcase, GraduationCap, Phone, Mail } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/forms'
import { Button } from '@/components/ui/button'
import { Skeleton, Separator } from '@/components/ui/components'
import { useToast } from '@/hooks/useToast'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCTC, openSignedFile, cn, getStatusBadgeClass } from '@/lib/utils'
import { CandidateFormDialog, type Candidate } from './CandidateFormDialog'
import { InterviewFormDialog, RESULTS, type Interview } from './InterviewFormDialog'

interface CandidateDetailDialogProps {
  submissionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after any edit (candidate updated, interview scheduled) so the
   * Kanban board behind this dialog can refresh. */
  onChanged: () => void
}

/** Clicking a card in the per-requirement Kanban board opens this — full
 * candidate details plus that submission's interview history, with actions
 * to edit the candidate or schedule/update an interview right here, rather
 * than navigating to separate Candidates/Interviews pages (both removed). */
export function CandidateDetailDialog({ submissionId, open, onOpenChange, onChanged }: CandidateDetailDialogProps) {
  const { toast } = useToast()
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [submission, setSubmission] = useState<{ id: string; status: string; requirement_id: string } | null>(null)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [interviewOpen, setInterviewOpen] = useState(false)
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null)

  const load = async () => {
    if (!submissionId) return
    setLoading(true)
    const { data: sub } = await supabase.from('submissions').select('id, status, requirement_id, candidate_id, candidates(*)').eq('id', submissionId).single()
    if (sub) {
      setSubmission({ id: sub.id, status: sub.status, requirement_id: sub.requirement_id })
      setCandidate(sub.candidates as any)
    }
    const { data: ivs } = await supabase.from('interviews').select('*').eq('submission_id', submissionId).order('interview_date', { ascending: false })
    setInterviews(ivs ?? [])
    setLoading(false)
  }

  useEffect(() => { if (open) load() }, [open, submissionId])

  const handleRefreshAfterChange = () => {
    load()
    onChanged()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{candidate?.candidate_name ?? 'Candidate'}</DialogTitle>
          </DialogHeader>

          {loading || !candidate ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {submission && (
                  <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", getStatusBadgeClass(submission.status))}>
                    {submission.status.replace(/_/g, ' ')}
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit Candidate
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{candidate.mobile_number}</div>
                <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{candidate.email_address}</div>
                {candidate.current_location && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{candidate.current_location}</div>}
                {candidate.total_experience != null && <div className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" />{candidate.total_experience} yrs experience</div>}
                {candidate.highest_qualification && <div className="flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />{candidate.highest_qualification}{candidate.university ? `, ${candidate.university}` : ''}</div>}
                {candidate.expected_ctc != null && <div className="text-emerald-600 font-medium">Expected CTC: {formatCTC(candidate.expected_ctc)}</div>}
              </div>

              {candidate.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {candidate.skills.map(s => (
                    <span key={s} className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">{s}</span>
                  ))}
                </div>
              )}

              {candidate.resume_url && (
                <button
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  onClick={async () => {
                    const { error } = await openSignedFile('resumes', candidate.resume_url!)
                    if (error) toast({ title: 'Could not open resume', variant: 'destructive' })
                  }}
                >
                  <FileText className="h-3.5 w-3.5" /> View Resume
                </button>
              )}

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Interview History</p>
                  <Button variant="outline" size="sm" onClick={() => { setEditingInterview(null); setInterviewOpen(true) }}>
                    <CalendarPlus className="h-3.5 w-3.5 mr-1.5" /> Schedule Interview
                  </Button>
                </div>
                {interviews.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No interviews scheduled yet</p>
                ) : (
                  <div className="space-y-2">
                    {interviews.map(iv => (
                      <button
                        key={iv.id}
                        onClick={() => { setEditingInterview(iv); setInterviewOpen(true) }}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 text-left"
                      >
                        <div>
                          <p className="text-sm font-medium">{iv.interview_round} — {formatDate(iv.interview_date)}{iv.interview_time ? ` at ${iv.interview_time}` : ''}</p>
                          {iv.interviewer && <p className="text-xs text-muted-foreground">Interviewer: {iv.interviewer}</p>}
                        </div>
                        <span className={cn("text-xs font-semibold rounded-full px-2 py-0.5", getStatusBadgeClass(iv.result))}>
                          {RESULTS.find(r => r.value === iv.result)?.label ?? iv.result}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CandidateFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={candidate}
        onSaved={handleRefreshAfterChange}
      />

      {submission && candidate && (
        <InterviewFormDialog
          open={interviewOpen}
          onOpenChange={setInterviewOpen}
          submissionId={submission.id}
          candidateId={candidate.id}
          requirementId={submission.requirement_id}
          editing={editingInterview}
          onSaved={handleRefreshAfterChange}
        />
      )}
    </>
  )
}
