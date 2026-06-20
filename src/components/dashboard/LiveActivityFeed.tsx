import React, { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/components'
import { Skeleton } from '@/components/ui/components'
import { liveActivityService } from '@/lib/userInsightsService'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/utils'
import type { LiveActivityItem } from '@/types'

/** FEATURE 7: live activity monitor. Loads the latest 50 via
 * get_live_activity_feed() (SECURITY INVOKER, so RLS naturally limits a
 * recruiter to their own rows and an admin to everyone's), then layers a
 * Supabase Realtime subscription on top so new rows stream in without
 * polling. Realtime postgres_changes payloads are also subject to the same
 * RLS as the underlying table, so a recruiter's subscription will only
 * ever receive their own new activity. */
export function LiveActivityFeed() {
  const [items, setItems] = useState<LiveActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    liveActivityService.getFeed(50).then(({ data }) => {
      if (active) { setItems(data ?? []); setLoading(false) }
    })

    const channel = supabase
      .channel('live-activity-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        const row = payload.new as any
        const item: LiveActivityItem = {
          id: row.id, user_id: row.user_id, user_name: row.user_name, role: row.role,
          module_name: row.module, activity_type: row.activity_type ?? row.action,
          activity_description: row.details ?? row.action, reference_id: row.record_id, created_at: row.created_at,
        }
        setItems(prev => [item, ...prev].slice(0, 50))
      })
      .subscribe()

    return () => { active = false; supabase.removeChannel(channel) }
  }, [])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-primary" /> Live Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No activity yet</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {items.map(item => (
              <div key={item.id} className="flex gap-2.5 text-xs">
                <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0 w-16 pt-0.5">
                  {new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
                <p className="leading-snug">
                  <span className="font-medium">{item.user_name}</span>{' '}
                  <span className="text-muted-foreground">{item.activity_description ?? item.activity_type}</span>
                  <span className="text-muted-foreground/70 text-[10px] ml-1">({item.module_name})</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
