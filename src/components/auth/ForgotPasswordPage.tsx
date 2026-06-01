import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/forms'
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-4">
            <img src="/talendro-logo.svg" alt="Talendro Solutions" className="h-16 w-auto object-contain" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 shadow-2xl">
          {sent ? (
            <div className="text-center">
              <CheckCircle className="h-10 w-10 text-teal-400 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-white mb-2">Check your email</h2>
              <p className="text-white/60 text-sm mb-4">We sent a password reset link to {email}</p>
              <Link to="/login">
                <Button className="bg-teal-500 hover:bg-teal-400 text-white w-full">Back to Login</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-white">Reset Password</h2>
                <p className="text-white/50 text-xs mt-1">Enter your email to receive a reset link</p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-white/80 text-xs">Email Address</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-teal-400"
                  />
                </div>
                <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-400 text-white" disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending…</> : 'Send Reset Link'}
                </Button>
              </form>

              <Link to="/login" className="flex items-center justify-center gap-1.5 mt-4 text-xs text-white/50 hover:text-white/80 transition-colors">
                <ArrowLeft className="h-3 w-3" /> Back to Login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
