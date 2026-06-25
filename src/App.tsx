import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useRealtimeNotifications } from './hooks/useRealtimeNotifications'
import { ToastContainer } from './components/ui/toast'
import { ErrorBoundary } from './components/ui/error-boundary'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './components/auth/LoginPage'
import { SignupPage } from './components/auth/SignupPage'
import { ProfileCompletionModal } from './components/auth/ProfileCompletionModal'
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './components/auth/ResetPasswordPage'
import { PendingApproval } from './components/auth/PendingApproval'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { ClientsPage } from './components/clients/ClientsPage'
import { VendorsPage } from './components/vendors/VendorsPage'
import { RequirementsPage } from './components/requirements/RequirementsPage'
import { SubmissionsPage } from './components/submissions/SubmissionsPage'
import { OffersPage } from './components/offers/OffersPage'
import { ReportsPage } from './components/reports/ReportsPage'
import { BulkUploadPage } from './components/bulk/BulkUploadPage'
import { NotificationsPage } from './components/notifications/NotificationsPage'
import { ActivityPage } from './components/activity/ActivityPage'
import { UsersPage } from './components/activity/UsersPage'
import { TeamsPage } from './components/activity/TeamsPage'
import { TargetsPage } from './components/activity/TargetsPage'
import { SettingsPage } from './components/activity/SettingsPage'
import { NotFoundPage, ForbiddenPage } from './components/ui/error-pages'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  useRealtimeNotifications()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <img src="/talendro-logo.svg" alt="Talendro" className="h-12 w-auto mx-auto opacity-50" />
          <div className="h-1 w-32 bg-muted rounded-full overflow-hidden mx-auto">
            <div className="h-full w-full bg-gradient-to-r from-primary to-secondary rounded-full animate-pulse" />
          </div>
          <p className="text-xs text-muted-foreground">Loading Talendro ROP…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (profile?.status === 'pending') return <PendingApproval />
  if (profile?.status === 'rejected' || profile?.status === 'inactive') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 p-4">
        <div className="bg-white/10 border border-white/20 rounded-2xl p-8 text-center max-w-sm w-full">
          <p className="text-white text-lg font-semibold mb-2">Account {profile.status === 'rejected' ? 'Rejected' : 'Deactivated'}</p>
          <p className="text-white/60 text-sm mb-4">Contact your administrator for access.</p>
          <button onClick={() => { window.location.href = '/login' }} className="text-teal-400 hover:underline text-sm">Back to Login</button>
        </div>
      </div>
    )
  }
  // FEATURE 2: mandatory profile completion. children (the entire routed
  // app shell, including all navigation) is never rendered while this is
  // true — there is no route or nav action that bypasses it.
  if (profile?.status === 'approved' && profile.profile_completed === false) {
    return <ProfileCompletionModal />
  }
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <ForbiddenPage />
  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()
  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark')
  }, [])

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
        <Route path="clients" element={<ErrorBoundary><ClientsPage /></ErrorBoundary>} />
        <Route path="vendors" element={<ErrorBoundary><VendorsPage /></ErrorBoundary>} />
        <Route path="requirements" element={<ErrorBoundary><RequirementsPage /></ErrorBoundary>} />
        <Route path="submissions" element={<ErrorBoundary><SubmissionsPage /></ErrorBoundary>} />
        <Route path="offers" element={<ErrorBoundary><OffersPage /></ErrorBoundary>} />
        <Route path="reports" element={<ErrorBoundary><ReportsPage /></ErrorBoundary>} />
        <Route path="bulk-upload" element={<ErrorBoundary><BulkUploadPage /></ErrorBoundary>} />
        <Route path="notifications" element={<ErrorBoundary><NotificationsPage /></ErrorBoundary>} />
        <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
        <Route path="teams" element={<RequireAdmin><ErrorBoundary><TeamsPage /></ErrorBoundary></RequireAdmin>} />
        <Route path="targets" element={<RequireAdmin><ErrorBoundary><TargetsPage /></ErrorBoundary></RequireAdmin>} />
        <Route path="activity" element={<RequireAdmin><ErrorBoundary><ActivityPage /></ErrorBoundary></RequireAdmin>} />
        <Route path="users" element={<RequireAdmin><ErrorBoundary><UsersPage /></ErrorBoundary></RequireAdmin>} />
        {/* Catches any unmatched path for authenticated users; RequireAuth above
            already redirects unauthenticated visitors to /login before this is
            ever reached, so a separate top-level "*" route is unreachable and
            was removed (every real URL starts with "/", so this nested branch
            always wins the route-ranking match first). */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
            <ToastContainer />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
