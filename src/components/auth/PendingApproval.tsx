import React from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Clock, LogOut } from 'lucide-react'

export function PendingApproval() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4">
      <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-8 text-center max-w-sm w-full">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Clock className="h-8 w-8 text-amber-400" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Pending Approval</h2>
        <p className="text-white/60 text-sm mb-1">Hello, {profile?.full_name}</p>
        <p className="text-white/60 text-sm mb-6">
          Your account is awaiting admin approval. You'll receive access once an administrator reviews your registration.
        </p>
        <Button
          onClick={signOut}
          variant="outline"
          className="w-full border-white/20 text-white hover:bg-white/10"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
