import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { resetPasswordSchema } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/forms'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'

// Completes the password-reset flow. ForgotPasswordPage sends an email whose
// link redirects here with a recovery token; the Supabase client (configured
// with detectSessionInUrl: true) parses that token automatically and
// establishes a temporary recovery session, after which auth.updateUser()
// can set a new password. Previously this route did not exist at all, so
// clicking the reset email's link led nowhere.
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    // detectSessionInUrl needs a moment to parse the recovery token from the
    // URL fragment and establish a session before we can call updateUser().
    supabase.auth.getSession().then(({ data }) => {
      setSessionReady(!!data.session)
      setCheckingSession(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setSessionReady(true)
        setCheckingSession(false)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = resetPasswordSchema.safeParse({ password, confirm_password: confirmPassword })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setSuccess(true)
    setTimeout(() => navigate('/login'), 2500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-4">
            <img src="/talendro-logo.svg" alt="Talendro Solutions" className="h-16 w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white">Talendro ROP</h1>
          <p className="text-sm text-white/50 mt-1">Set a new password</p>
        </div>

        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 shadow-2xl">
          {checkingSession ? (
            <div className="flex flex-col items-center gap-3 py-6 text-white/70">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Verifying your reset link…</p>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <p className="text-white font-medium">Password updated</p>
              <p className="text-sm text-white/60">Redirecting you to sign in…</p>
            </div>
          ) : !sessionReady ? (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-red-200">
                This reset link is invalid or has expired. Please request a new one.
              </p>
              <Button className="w-full" onClick={() => navigate('/forgot-password')}>
                Request new link
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-lg font-semibold text-white mb-1">Choose a new password</h2>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-white/80 text-xs">New Password</Label>
                <div className="relative">
                  <Input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-teal-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/80 text-xs">Confirm New Password</Label>
                <Input
                  type={showPwd ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-teal-400"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {loading ? 'Updating…' : 'Update Password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
