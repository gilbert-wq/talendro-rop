import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { QUERY_KEYS } from "@/hooks/useQueries"
import { queryClient } from "@/lib/queryClient"
import { addToast } from './useToast'

// Re-export QUERY_KEYS so other files can import from here
export { QUERY_KEYS } from './useQueries'

export function useRealtimeNotifications() {
  const { user } = useAuth()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!user) return

    // Clean up any existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Invalidate notifications cache
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications(user.id) })
          // Show toast
          const n = payload.new as any
          addToast({
            title: n.title,
            description: n.message,
            variant: n.type === 'error' ? 'destructive' : n.type === 'success' ? 'success' : 'default',
          })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [user])
}
