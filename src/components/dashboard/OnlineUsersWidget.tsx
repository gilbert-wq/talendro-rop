import React, { useEffect, useState } from 'react'
import { Wifi, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/components'
import { Skeleton } from '@/components/ui/components'
import { loginSessionService } from '@/lib/userInsightsService'
import { supabase } from '@/lib/supabase'
import type { OnlineUser } from '@/types'

const REFRESH_MS = 30_000

function formatOnlineDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** FEATURE 4: live online user tracking, admin dashboard widget. Polls
 * get_online_users() every 30s and opportunistically sweeps stale sessions
 * (>15 min without a heartbeat) via expire_stale_sessions() first, so the
 * list reflects "Inactive > 15 minutes: Mark Offline" accurately. */
export function OnlineUsersWidget() {
  const [users, setUsers] = useState<OnlineUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    await supabase.rpc('expire_stale_sessions')
    const { data, error } = await loginSessionService.getOnlineUsers()
    if (error) setError(error.message)
    else { setUsers(data ?? []); setError(null) }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const recruiters = users.filter(u => u.role === 'recruiter').length
  const admins = users.filter(u => u.role === 'admin').length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Wifi className="h-4 w-4 text-emerald-500" /> Online Users
        </CardTitle>
        <button onClick={load} className="text-muted-foreground hover:text-foreground" aria-label="Refresh online users">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <div className="rounded-lg bg-muted/50 py-1.5">
            <p className="text-base font-bold">{users.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Online</p>
          </div>
          <div className="rounded-lg bg-muted/50 py-1.5">
            <p className="text-base font-bold">{recruiters}</p>
            <p className="text-[10px] text-muted-foreground">Recruiters</p>
          </div>
          <div className="rounded-lg bg-muted/50 py-1.5">
            <p className="text-base font-bold">{admins}</p>
            <p className="text-[10px] text-muted-foreground">Admins</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : users.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">No one is currently online</p>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {users.map(u => (
              <div key={u.user_id} className="flex items-center justify-between text-xs py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="font-medium truncate">{u.full_name}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">{u.role}</span>
                </div>
                <span className="text-muted-foreground tabular-nums flex-shrink-0">{formatOnlineDuration(u.online_minutes)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
