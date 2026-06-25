import React, { useEffect, useRef, useState } from 'react'
import { Plus, Search, MapPin, Briefcase } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { logActivity } from '@/lib/activityLogger'
import { formatCTC, cn, escapeFilterValue } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/forms'
import { CandidateFormDialog } from './CandidateFormDialog'
import { CandidateDetailDialog } from './CandidateDetailDialog'

export const STAGES = [
  { id: 'sourced', label: 'Sourced', color: 'bg-gray-100 dark:bg-gray-800/50' },
  { id: 'submitted', label: 'Submitted', color: 'bg-blue-50 dark:bg-blue-950/30' },
  { id: 'shortlisted', label: 'Shortlisted', color: 'bg-indigo-50 dark:bg-indigo-950/30' },
  { id: 'interview_scheduled', label: 'Interview', color: 'bg-yellow-50 dark:bg-yellow-950/30' },
  { id: 'offered', label: 'Offered', color: 'bg-green-50 dark:bg-green-950/30' },
  { id: 'joined', label: 'Joined', color: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { id: 'rejected', label: 'Rejected', color: 'bg-red-50 dark:bg-red-950/30' },
]

const STAGE_DOT: Record<string, string> = {
  sourced: 'bg-gray-400', submitted: 'bg-blue-500', shortlisted: 'bg-indigo-500',
  interview_scheduled: 'bg-yellow-500', offered: 'bg-green-500', joined: 'bg-emerald-500', rejected: 'bg-red-500',
}

interface KanbanCard {
  id: string
  status: string
  candidate_name: string
  mobile_number: string
  current_location: string | null
  total_experience: number | null
  expected_ctc: number | null
  skills: string[]
}

interface KanbanBoardProps {
  requirementId: string
}

/** Per-requirement Kanban board — the only place candidates are now added
 * to/managed within a pipeline (the standalone global Kanban, Candidates,
 * and Interviews pages were removed in favor of consolidating everything
 * here, contextual to a specific requirement). */
export function KanbanBoard({ requirementId }: KanbanBoardProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [cards, setCards] = useState<KanbanCard[]>([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<KanbanCard | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollDirRef = useRef<0 | 1 | -1>(0)
  const scrollFrameRef = useRef<number | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [detailSubmissionId, setDetailSubmissionId] = useState<string | null>(null)

  useEffect(() => { fetchSubmissions() }, [requirementId])

  const fetchSubmissions = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('submissions')
      .select('id, status, candidates(candidate_name, mobile_number, current_location, total_experience, expected_ctc, skills)')
      .eq('requirement_id', requirementId)
      .order('created_at', { ascending: false })

    if (error) {
      toast({ title: 'Could not load pipeline', description: error.message, variant: 'destructive' })
      setLoading(false)
      return
    }

    setCards((data ?? []).map((s: any) => ({
      id: s.id,
      status: s.status,
      candidate_name: s.candidates?.candidate_name ?? 'Unknown',
      mobile_number: s.candidates?.mobile_number ?? '',
      current_location: s.candidates?.current_location ?? null,
      total_experience: s.candidates?.total_experience ?? null,
      expected_ctc: s.candidates?.expected_ctc ?? null,
      skills: s.candidates?.skills ?? [],
    })))
    setLoading(false)
  }

  // ── Auto-scroll while dragging near the edge of the horizontally
  // scrolling column row. Without this, columns past the visible width
  // (Offered/Joined/Rejected on narrower screens) are simply unreachable
  // while dragging — there's no way to scroll a native HTML5 drag over to
  // them, which is exactly the "unable to drop on Rejected" bug.
  const EDGE = 80
  const SPEED = 14

  const stopAutoScroll = () => {
    scrollDirRef.current = 0
    if (scrollFrameRef.current) { cancelAnimationFrame(scrollFrameRef.current); scrollFrameRef.current = null }
  }

  const runAutoScroll = () => {
    const el = scrollRef.current
    if (!el || scrollDirRef.current === 0) { scrollFrameRef.current = null; return }
    el.scrollLeft += scrollDirRef.current * SPEED
    scrollFrameRef.current = requestAnimationFrame(runAutoScroll)
  }

  const handleContainerDragOver = (e: React.DragEvent) => {
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX
    let dir: 0 | 1 | -1 = 0
    if (x < rect.left + EDGE) dir = -1
    else if (x > rect.right - EDGE) dir = 1
    scrollDirRef.current = dir
    if (dir !== 0 && !scrollFrameRef.current) scrollFrameRef.current = requestAnimationFrame(runAutoScroll)
  }

  const handleDragStart = (card: KanbanCard) => setDragging(card)

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    setDragOverStage(stageId)
  }

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    setDragOverStage(null)
    stopAutoScroll()
    if (!dragging || dragging.status === stageId) return

    setCards(prev => prev.map(c => c.id === dragging.id ? { ...c, status: stageId } : c))

    const { error } = await supabase.from('submissions').update({ status: stageId }).eq('id', dragging.id)
    if (error) {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' })
      fetchSubmissions()
    } else {
      await logActivity({ module: 'Kanban', action: `Moved candidate to ${stageId}`, details: dragging.candidate_name, recordId: dragging.id, activityType: 'submission_updated' })
      toast({ title: `Moved to ${STAGES.find(s => s.id === stageId)?.label}`, variant: 'success' })
    }
    setDragging(null)
  }

  const handleDragEnd = () => {
    setDragging(null)
    setDragOverStage(null)
    stopAutoScroll()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-xs text-muted-foreground">
          {STAGES.map(s => (
            <span key={s.id} className="flex items-center gap-1">
              <span className={cn("h-2 w-2 rounded-full", STAGE_DOT[s.id])} />
              {cards.filter(c => c.status === s.id).length}
            </span>
          ))}
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Candidate
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground text-sm animate-pulse">Loading pipeline…</div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-4" onDragOver={handleContainerDragOver}>
          {STAGES.map(stage => {
            const stageCards = cards.filter(c => c.status === stage.id)
            const isOver = dragOverStage === stage.id

            return (
              <div
                key={stage.id}
                className={cn(
                  "kanban-column min-w-[220px] transition-all duration-200",
                  stage.color,
                  isOver && "ring-2 ring-primary/50 scale-[1.01]"
                )}
                onDragOver={e => handleDragOver(e, stage.id)}
                onDrop={e => handleDrop(e, stage.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", STAGE_DOT[stage.id])} />
                    <h3 className="text-xs font-semibold">{stage.label}</h3>
                  </div>
                  <span className="text-xs bg-background rounded-full px-1.5 py-0.5 font-semibold border">
                    {stageCards.length}
                  </span>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  {stageCards.map(card => (
                    <div
                      key={card.id}
                      className={cn("kanban-card cursor-pointer", dragging?.id === card.id && "opacity-50")}
                      draggable
                      onDragStart={() => handleDragStart(card)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setDetailSubmissionId(card.id)}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                          {card.candidate_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{card.candidate_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{card.mobile_number}</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {card.current_location && (
                            <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{card.current_location}</span>
                          )}
                          {card.total_experience != null && (
                            <span className="flex items-center gap-0.5"><Briefcase className="h-2.5 w-2.5" />{card.total_experience}y</span>
                          )}
                        </div>
                        {card.expected_ctc && (
                          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {formatCTC(card.expected_ctc)}
                          </p>
                        )}
                        {card.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {card.skills.slice(0, 2).map(s => (
                              <span key={s} className="bg-primary/10 text-primary text-[10px] rounded-full px-1.5 py-0.5">{s}</span>
                            ))}
                            {card.skills.length > 2 && <span className="text-[10px] text-muted-foreground">+{card.skills.length - 2}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {stageCards.length === 0 && (
                    <div className={cn("flex items-center justify-center h-16 rounded-lg border-2 border-dashed text-xs text-muted-foreground transition-colors", isOver && "border-primary text-primary")}>
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AddCandidateFlow
        open={addOpen}
        onOpenChange={setAddOpen}
        requirementId={requirementId}
        onAdded={fetchSubmissions}
      />

      <CandidateDetailDialog
        submissionId={detailSubmissionId}
        open={!!detailSubmissionId}
        onOpenChange={(open) => { if (!open) setDetailSubmissionId(null) }}
        onChanged={fetchSubmissions}
      />
    </div>
  )
}

// ── Add Candidate flow: search an existing candidate by mobile/email first
// (avoids duplicate candidate records — this duplicate-avoidance existed on
// the old standalone Candidates page and is worth preserving), falling
// back to the full new-candidate form if there's no match. ──────────────
function AddCandidateFlow({ open, onOpenChange, requirementId, onAdded }: {
  open: boolean; onOpenChange: (open: boolean) => void; requirementId: string; onAdded: () => void
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => { if (!open) { setQuery(''); setResults([]) } }, [open])

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    const q = escapeFilterValue(query.trim())
    const { data } = await supabase
      .from('candidates')
      .select('id, candidate_name, mobile_number, email_address, current_location, total_experience')
      .or(`candidate_name.ilike.%${q}%,mobile_number.ilike.%${q}%,email_address.ilike.%${q}%`)
      .limit(10)
    setResults(data ?? [])
    setSearching(false)
  }

  const handleAddExisting = async (candidateId: string, name: string) => {
    const { data: existing } = await supabase.from('submissions').select('id').eq('requirement_id', requirementId).eq('candidate_id', candidateId)
    if (existing && existing.length > 0) {
      toast({ title: 'Already in this pipeline', description: `${name} has already been submitted for this requirement`, variant: 'destructive' })
      return
    }
    const { error } = await supabase.from('submissions').insert({ requirement_id: requirementId, candidate_id: candidateId, status: 'sourced', submitted_by: user!.id })
    if (error) {
      toast({ title: 'Could not add candidate', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: `${name} added to pipeline`, variant: 'success' })
    onOpenChange(false)
    onAdded()
  }

  return (
    <>
      <Dialog open={open && !createOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Candidate to this Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search by name, mobile, or email…"
              />
              <Button variant="outline" onClick={handleSearch} disabled={searching}>
                <Search className="h-3.5 w-3.5" />
              </Button>
            </div>

            {results.length > 0 && (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {results.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleAddExisting(c.id, c.candidate_name)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium">{c.candidate_name}</p>
                      <p className="text-xs text-muted-foreground">{c.mobile_number} · {c.email_address}</p>
                    </div>
                    <span className="text-xs text-primary">Add</span>
                  </button>
                ))}
              </div>
            )}

            {query && results.length === 0 && !searching && (
              <p className="text-xs text-muted-foreground text-center py-2">No existing candidate matched — create a new one instead.</p>
            )}

            <Button variant="outline" className="w-full" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create New Candidate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CandidateFormDialog
        open={createOpen}
        onOpenChange={(o) => { setCreateOpen(o); if (!o) onOpenChange(false) }}
        requirementId={requirementId}
        onSaved={onAdded}
      />
    </>
  )
}
