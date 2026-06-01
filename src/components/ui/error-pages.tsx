import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Lock, WifiOff, Clock, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

// ─── 404 Not Found ────────────────────────────────────────────────────────────
export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black text-primary/20 mb-4">404</div>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/dashboard">
            <Button><Home className="h-4 w-4 mr-2" /> Go to Dashboard</Button>
          </Link>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── 403 Forbidden ────────────────────────────────────────────────────────────
export function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <Lock className="h-10 w-10 text-destructive" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You don't have permission to access this page. Contact your administrator.</p>
        <Link to="/dashboard">
          <Button><Home className="h-4 w-4 mr-2" /> Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}

// ─── Session Expired ──────────────────────────────────────────────────────────
export function SessionExpiredPage() {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4">
      <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-8 text-center max-w-sm w-full">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Clock className="h-8 w-8 text-amber-400" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Session Expired</h2>
        <p className="text-white/60 text-sm mb-6">Your session has expired. Please sign in again to continue.</p>
        <Button
          className="w-full bg-teal-500 hover:bg-teal-400 text-white"
          onClick={async () => { await signOut(); window.location.href = '/login' }}
        >
          Sign In Again
        </Button>
      </div>
    </div>
  )
}

// ─── Offline ──────────────────────────────────────────────────────────────────
export function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <WifiOff className="h-10 w-10 text-muted-foreground" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">You're Offline</h1>
        <p className="text-muted-foreground mb-6">Please check your internet connection and try again.</p>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    </div>
  )
}
