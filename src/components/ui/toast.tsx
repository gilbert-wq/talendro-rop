import React from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToasts } from '@/hooks/useToast'

export function ToastContainer() {
  const { toasts, dismiss } = useToasts()

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg animate-in min-w-[300px] max-w-[420px]",
            toast.variant === 'destructive'
              ? "bg-destructive text-destructive-foreground border-destructive"
              : toast.variant === 'success'
              ? "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800"
              : "bg-card text-card-foreground border-border"
          )}
        >
          {toast.variant === 'success' && <CheckCircle className="h-4 w-4 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />}
          {toast.variant === 'destructive' && <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
          {(!toast.variant || toast.variant === 'default') && <Info className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />}
          <div className="flex-1">
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description && <p className="text-xs opacity-80 mt-0.5">{toast.description}</p>}
          </div>
          <button onClick={() => dismiss(toast.id)} className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
