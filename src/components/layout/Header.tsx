import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, Sun, Moon, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { LiveClock } from '@/components/common/LiveClock'

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/profile': 'My Profile',
  '/clients': 'Client Management',
  '/vendors': 'Vendor Management',
  '/requirements': 'Requirements',
  '/recruiters': 'Recruiters',
  '/submissions': 'Submission Tracker',
  '/offers': 'Offers & Joinings',
  '/reports': 'Reports',
  '/bulk-upload': 'Bulk Upload Center',
  '/activity': 'Activity Logs',
  '/users': 'User Management',
  '/settings': 'Settings',
}

interface HeaderProps {
  sidebarCollapsed: boolean
  darkMode: boolean
  onToggleDark: () => void
}

export function Header({ sidebarCollapsed, darkMode, onToggleDark }: HeaderProps) {
  const location = useLocation()
  const { user } = useAuth()
  const [notifCount, setNotifCount] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [notifs, setNotifs] = useState<any[]>([])

  const title = routeTitles[location.pathname] ?? 'Talendro ROP'

  useEffect(() => {
    if (!user) return
    fetchNotifs()
  }, [user])

  const fetchNotifs = async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setNotifs(data ?? [])
    setNotifCount((data ?? []).filter((n: any) => !n.read).length)
  }

  const markAllRead = async () => {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifCount(0)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-14 z-30 flex items-center justify-between px-5 border-b border-border bg-card/90 backdrop-blur-sm transition-all duration-300",
        sidebarCollapsed ? "left-16" : "left-[260px]"
      )}
    >
      <div>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <LiveClock />
        <Button variant="ghost" size="icon" onClick={onToggleDark} title={darkMode ? 'Light mode' : 'Dark mode'}>
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setShowNotifs(!showNotifs)}>
            <Bell className="h-4 w-4" />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </Button>

          {showNotifs && (
            <div className="absolute right-0 top-11 w-80 rounded-xl border bg-card shadow-xl z-50">
              <div className="flex items-center justify-between p-3 border-b">
                <p className="font-semibold text-sm">Notifications</p>
                {notifCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all read</button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">No notifications</p>
                ) : (
                  notifs.map(n => (
                    <div key={n.id} className={cn("p-3 border-b last:border-0 text-xs", !n.read && "bg-primary/5")}>
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />}
                        <div>
                          <p className="font-medium">{n.title}</p>
                          <p className="text-muted-foreground mt-0.5">{n.message}</p>
                          <p className="text-muted-foreground/70 mt-1">{formatDateTime(n.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
