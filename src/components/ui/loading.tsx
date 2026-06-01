import React from 'react'
import { Loader2, SearchX, FolderOpen, Users, FileText, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ─── Spinner ─────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-primary', className)} />
}

// ─── Page Loading ─────────────────────────────────────────────────────────────
export function PageLoader({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
      <Spinner className="h-8 w-8" />
      <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
    </div>
  )
}

// ─── Inline loader ────────────────────────────────────────────────────────────
export function InlineLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Spinner />
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ElementType
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon = FolderOpen, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[240px] p-8 text-center rounded-xl border-2 border-dashed border-border">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-base mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mb-4 max-w-xs">{description}</p>}
      {action && (
        <Button size="sm" onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  )
}

// ─── Table skeleton ───────────────────────────────────────────────────────────
export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-container">
      <div className="p-3 border-b bg-muted/30">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-3 bg-muted rounded animate-pulse flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-3 bg-muted/70 rounded animate-pulse flex-1"
              style={{ animationDelay: `${(i * cols + j) * 30}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Card skeleton ────────────────────────────────────────────────────────────
export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-2.5 bg-muted rounded animate-pulse w-20" />
              <div className="h-6 bg-muted rounded animate-pulse w-12" />
            </div>
            <div className="h-9 w-9 bg-muted rounded-lg animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Specific Empty States ────────────────────────────────────────────────────
export const EMPTY_STATES = {
  candidates: <EmptyState icon={Users} title="No candidates yet" description="Add your first candidate to start building your talent database." />,
  submissions: <EmptyState icon={Send} title="No submissions yet" description="Submit candidates against open requirements to track them here." />,
  requirements: <EmptyState icon={FileText} title="No requirements yet" description="Create your first job requirement to start the recruitment process." />,
  search: <EmptyState icon={SearchX} title="No results found" description="Try adjusting your search or filters to find what you're looking for." />,
}
