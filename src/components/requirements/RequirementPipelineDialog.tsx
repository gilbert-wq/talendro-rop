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

/** Clicking an FG ID in RequirementsPage opens this — the same drag-and-drop
 * Kanban board as the global Pipeline page, scoped to just this
 * requirement's submissions via KanbanBoard's requirementId prop. */
export function RequirementPipelineDialog({ requirementId, fgId, requirementTitle, open, onOpenChange }: RequirementPipelineDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="mono">{fgId}</DialogTitle>
          <DialogDescription>{requirementTitle} — drag candidates between stages to update their status</DialogDescription>
        </DialogHeader>
        {requirementId && <KanbanBoard requirementId={requirementId} compact />}
      </DialogContent>
    </Dialog>
  )
}
