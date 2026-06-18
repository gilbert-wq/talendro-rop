import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props { children: React.ReactNode; fallback?: React.ReactNode }
interface State { hasError: boolean; error: Error | null }

// Pluggable error-reporting sink. Previously componentDidCatch only did
// console.error, so a production crash was invisible unless a user
// happened to report it. This keeps the app dependency-free (no Sentry SDK
// added speculatively) while giving ops a single place to wire one in:
//   import * as Sentry from '@sentry/react'
//   reportError = (error, info) => Sentry.captureException(error, { extra: info })
export let reportError: (error: Error, info: React.ErrorInfo) => void = () => {}
export function setErrorReporter(fn: (error: Error, info: React.ErrorInfo) => void) {
  reportError = fn
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
    try { reportError(error, info) } catch { /* never let the reporter itself crash the app */ }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 rounded-xl border border-destructive/30 bg-destructive/5 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
          <h3 className="font-semibold text-lg mb-1">Something went wrong</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" /> Reload Page
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
