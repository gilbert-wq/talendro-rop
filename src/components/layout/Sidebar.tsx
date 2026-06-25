import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, Truck, FileText,
  Send, Gift, BarChart3, Activity,
  Bell, Upload, Settings, ChevronLeft, ChevronRight, LogOut,
  Shield, Target, UsersRound
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useQueries'

interface NavItem {
  label: string
  icon: React.ElementType
  href: string
  adminOnly?: boolean
  badge?: number
}

function useNavItems() {
  const { user } = useAuth()
  const { data: notifs = [] } = useNotifications()
  const unread = notifs.filter((n: any) => !n.read).length

  const items: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Clients', icon: Building2, href: '/clients' },
    { label: 'Vendors', icon: Truck, href: '/vendors' },
    { label: 'Requirements', icon: FileText, href: '/requirements' },
    { label: 'Submissions', icon: Send, href: '/submissions' },
    { label: 'Offers & Joinings', icon: Gift, href: '/offers' },
    { label: 'Reports', icon: BarChart3, href: '/reports' },
    { label: 'Bulk Upload', icon: Upload, href: '/bulk-upload' },
    { label: 'Notifications', icon: Bell, href: '/notifications', badge: unread || undefined },
    { label: 'Teams', icon: UsersRound, href: '/teams', adminOnly: true },
    { label: 'KPI & Targets', icon: Target, href: '/targets', adminOnly: true },
    { label: 'Activity Logs', icon: Activity, href: '/activity', adminOnly: true },
    { label: 'User Management', icon: Users, href: '/users', adminOnly: true },
    { label: 'Settings', icon: Settings, href: '/settings' },
  ]
  return items
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { profile, isAdmin, signOut } = useAuth()
  const navItems = useNavItems()
  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full z-40 flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out shadow-sm",
        collapsed ? "w-16" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center border-b border-border flex-shrink-0",
        collapsed ? "p-3 justify-center" : "p-4 gap-3"
      )}>
        <img
          src="/talendro-logo.svg"
          alt="Talendro Solutions"
          className={cn("object-contain flex-shrink-0", collapsed ? "w-8 h-8" : "w-10 h-10")}
        />
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-sm text-primary leading-tight">Talendro ROP</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Recruit. Track. Submit. Hire.</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleItems.map(item => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn("sidebar-nav-item relative", isActive && "active", collapsed && "justify-center px-2")
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {item.badge && item.badge > 0 && (
              <span className={cn(
                "rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center",
                collapsed ? "absolute top-1 right-1 h-4 w-4" : "ml-auto h-4 min-w-[16px] px-1"
              )}>
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className={cn("border-t border-border p-3 flex-shrink-0", collapsed ? "flex justify-center" : "flex items-center gap-3")}>
        {!collapsed && (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold truncate">{profile?.full_name}</p>
              <div className="flex items-center gap-1">
                {isAdmin && <Shield className="h-2.5 w-2.5 text-primary" />}
                <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
              </div>
            </div>
            <button onClick={signOut} className="text-muted-foreground hover:text-destructive transition-colors" title="Sign Out">
              <LogOut className="h-4 w-4" />
            </button>
          </>
        )}
        {collapsed && (
          <button onClick={signOut} className="text-muted-foreground hover:text-destructive transition-colors" title="Sign Out">
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-muted transition-colors z-50"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  )
}
