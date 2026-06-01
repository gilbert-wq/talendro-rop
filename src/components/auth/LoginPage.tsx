import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/forms'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-4">
            <img src="/talendro-logo.png" alt="Talendro Solutions" className="h-16 w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white">Talendro ROP</h1>
          <p className="text-sm text-white/50 mt-1">Recruit. Track. Submit. Hire.</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-5">Sign in to your account</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/80 text-xs">Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@talendro.com"
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-teal-400"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/80 text-xs">Password</Label>
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
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-teal-400 hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-400 text-white font-semibold" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Signing in…</> : 'Sign In'}
            </Button>
          </form>

          <p className="text-center text-xs text-white/50 mt-4">
            Don't have an account?{' '}
            <Link to="/signup" className="text-teal-400 hover:underline font-medium">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
