import React from 'react'
import { KanbanBoard } from './KanbanBoard'

export function KanbanPage() {
  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kanban Pipeline</h1>
          <p className="text-sm text-muted-foreground">Drag candidates to update their status</p>
        </div>
      </div>
      <KanbanBoard />
    </div>
  )
}
