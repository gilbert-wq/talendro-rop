import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/forms'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'

interface RequirementPipelineDialogProps {
  requirementId: string | null
  fgId?: string
  requirementTitle?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Clicking an FG ID in RequirementsPage opens this — the per-requirement
 * Kanban board, which is now the only place candidates get added to a
 * pipeline (the global Kanban/Candidates/Interviews pages were removed in
 * favor of consolidating everything here). */
export function RequirementPipelineDialog({ requirementId, fgId, requirementTitle, open, onOpenChange }: RequirementPipelineDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] xl:max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="mono">{fgId}</DialogTitle>
          <DialogDescription>{requirementTitle} — drag candidates between stages, or click a card for details</DialogDescription>
        </DialogHeader>
        {requirementId && <KanbanBoard requirementId={requirementId} />}
      </DialogContent>
    </Dialog>
  )
}
