import React, { useState } from 'react'
import { Bell, CheckCheck, Trash2, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useQueries'
import { notificationsService } from '@/lib/services'
import { QUERY_KEYS } from "@/hooks/useQueries"
import { queryClient } from "@/lib/queryClient"
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { formatDateTime, cn } from '@/lib/utils'
import type { Notification } from '@/types'

const TYPE_ICON: Record<string, React.ElementType> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
}

const TYPE_COLOR: Record<string, string> = {
  info: 'text-blue-500',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  error: 'text-destructive',
}

export function NotificationsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: notifications = [], isLoading } = useNotifications()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const displayed = filter === 'unread' ? notifications.filter(n => !n.read) : notifications
  const unreadCount = notifications.filter(n => !n.read).length

  const markRead = async (n: Notification) => {
    await notificationsService.markRead(n.id)
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications(user!.id) })
  }

  const markAllRead = async () => {
    if (!user) return
    await notificationsService.markAllRead(user.id)
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications(user.id) })
    toast({ title: 'All notifications marked as read', variant: 'success' })
  }

  const deleteNotification = async (n: Notification) => {
    await notificationsService.delete(n.id)
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications(user!.id) })
  }

  const clearAll = async () => {
    if (!user || !confirm('Clear all notifications?')) return
    await notificationsService.deleteAll(user.id)
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications(user.id) })
    toast({ title: 'All notifications cleared', variant: 'success' })
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notification Center
            {unreadCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">{notifications.length} total notifications</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Mark All Read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAll} className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize",
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {f} {f === 'unread' && unreadCount > 0 && `(${unreadCount})`}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border-2 border-dashed border-border">
          <Bell className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
          <p className="text-sm text-muted-foreground mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(n => {
            const Icon = TYPE_ICON[n.type] ?? Info
            return (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-xl border bg-card transition-all",
                  !n.read && "border-primary/30 bg-primary/5"
                )}
              >
                <div className={cn("flex-shrink-0 mt-0.5", TYPE_COLOR[n.type])}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm font-medium", !n.read && "font-semibold")}>{n.title}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatDateTime(n.created_at)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  {!n.read && (
                    <button
                      onClick={() => markRead(n)}
                      className="text-xs text-primary hover:underline mt-1.5"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
                {!n.read && (
                  <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                )}
                <button
                  onClick={() => deleteNotification(n)}
                  className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
