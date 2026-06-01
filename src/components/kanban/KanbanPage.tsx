import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/useToast'
import { logActivity } from '@/lib/activityLogger'
import { formatCTC, cn } from '@/lib/utils'
import { User, MapPin, Clock, Briefcase } from 'lucide-react'

const STAGES = [
  { id: 'sourced', label: 'Sourced', color: 'bg-gray-100 dark:bg-gray-800/50', badge: 'badge-sourced' },
  { id: 'submitted', label: 'Submitted', color: 'bg-blue-50 dark:bg-blue-950/30', badge: 'badge-submitted' },
  { id: 'shortlisted', label: 'Shortlisted', color: 'bg-indigo-50 dark:bg-indigo-950/30', badge: 'badge-shortlisted' },
  { id: 'interview_scheduled', label: 'Interview', color: 'bg-yellow-50 dark:bg-yellow-950/30', badge: 'badge-interview' },
  { id: 'offered', label: 'Offered', color: 'bg-green-50 dark:bg-green-950/30', badge: 'badge-offered' },
  { id: 'joined', label: 'Joined', color: 'bg-emerald-50 dark:bg-emerald-950/30', badge: 'badge-joined' },
  { id: 'rejected', label: 'Rejected', color: 'bg-red-50 dark:bg-red-950/30', badge: 'badge-rejected' },
]

interface KanbanCard {
  id: string
  status: string
  candidate_name: string
  mobile_number: string
  current_location: string | null
  total_experience: number | null
  expected_ctc: number | null
  skills: string[]
  fg_id: string
  requirement_title: string
}

export function KanbanPage() {
  const { toast } = useToast()
  const [cards, setCards] = useState<KanbanCard[]>([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<KanbanCard | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  useEffect(() => { fetchSubmissions() }, [])

  const fetchSubmissions = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('submissions')
      .select('id, status, candidates(candidate_name, mobile_number, current_location, total_experience, expected_ctc, skills), requirements(fg_id, requirement_title)')
      .order('created_at', { ascending: false })

    const mapped: KanbanCard[] = (data ?? []).map((s: any) => ({
      id: s.id,
      status: s.status,
      candidate_name: s.candidates?.candidate_name ?? 'Unknown',
      mobile_number: s.candidates?.mobile_number ?? '',
      current_location: s.candidates?.current_location ?? null,
      total_experience: s.candidates?.total_experience ?? null,
      expected_ctc: s.candidates?.expected_ctc ?? null,
      skills: s.candidates?.skills ?? [],
      fg_id: s.requirements?.fg_id ?? '',
      requirement_title: s.requirements?.requirement_title ?? '',
    }))
    setCards(mapped)
    setLoading(false)
  }

  const handleDragStart = (card: KanbanCard) => {
    setDragging(card)
  }

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    setDragOverStage(stageId)
  }

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    setDragOverStage(null)
    if (!dragging || dragging.status === stageId) return

    // Optimistic update
    setCards(prev => prev.map(c => c.id === dragging.id ? { ...c, status: stageId } : c))

    const { error } = await supabase.from('submissions').update({ status: stageId }).eq('id', dragging.id)
    if (error) {
      toast({ title: 'Failed to update status', variant: 'destructive' })
      fetchSubmissions()
    } else {
      await logActivity({ module: 'Kanban', action: `Moved candidate to ${stageId}`, details: dragging.candidate_name, recordId: dragging.id })
      toast({ title: `Moved to ${STAGES.find(s => s.id === stageId)?.label}`, variant: 'success' })
    }
    setDragging(null)
  }

  const handleDragEnd = () => {
    setDragging(null)
    setDragOverStage(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm animate-pulse">Loading pipeline…</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kanban Pipeline</h1>
          <p className="text-sm text-muted-foreground">Drag candidates to update their status</p>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          {STAGES.map(s => (
            <span key={s.id} className="flex items-center gap-1">
              <span className={cn("h-2 w-2 rounded-full", s.badge.replace('badge-', 'bg-'))} />
              {cards.filter(c => c.status === s.id).length}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageCards = cards.filter(c => c.status === stage.id)
          const isOver = dragOverStage === stage.id

          return (
            <div
              key={stage.id}
              className={cn(
                "kanban-column transition-all duration-200",
                stage.color,
                isOver && "ring-2 ring-primary/50 scale-[1.01]"
              )}
              onDragOver={e => handleDragOver(e, stage.id)}
              onDrop={e => handleDrop(e, stage.id)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", stage.id === 'sourced' ? 'bg-gray-400' : stage.id === 'submitted' ? 'bg-blue-500' : stage.id === 'shortlisted' ? 'bg-indigo-500' : stage.id === 'interview_scheduled' ? 'bg-yellow-500' : stage.id === 'offered' ? 'bg-green-500' : stage.id === 'joined' ? 'bg-emerald-500' : 'bg-red-500')} />
                  <h3 className="text-xs font-semibold">{stage.label}</h3>
                </div>
                <span className="text-xs bg-background rounded-full px-1.5 py-0.5 font-semibold border">
                  {stageCards.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 flex-1">
                {stageCards.map(card => (
                  <div
                    key={card.id}
                    className={cn("kanban-card", dragging?.id === card.id && "opacity-50")}
                    draggable
                    onDragStart={() => handleDragStart(card)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                        {card.candidate_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{card.candidate_name}</p>
                        <p className="text-xs text-muted-foreground truncate mono">{card.fg_id}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground truncate">{card.requirement_title}</p>
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
    </div>
  )
}
