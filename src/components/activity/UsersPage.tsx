import React, { useEffect, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { CheckCircle, XCircle, UserX, UserCheck, RotateCcw, Shield, Briefcase } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/useToast'
import { logActivity } from '@/lib/activityLogger'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { RecruiterProfileCard } from '@/components/users/RecruiterProfileCard'
import { formatDateTime, getStatusBadgeClass, cn } from '@/lib/utils'

interface Profile {
  id: string
  email: string
  full_name: string
  role: string
  status: string
  phone: string | null
  created_at: string
}

const ROLE_OPTIONS = [
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'admin', label: 'Admin' },
]

export function UsersPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [profileCardUserId, setProfileCardUserId] = useState<string | null>(null)

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }

  const updateStatus = async (user: Profile, status: string) => {
    await supabase.from('profiles').update({ status }).eq('id', user.id)
    await logActivity({
      module: 'Users', action: `${status} recruiter`, details: user.full_name, recordId: user.id,
      activityType: status === 'approved' ? 'user_approved' : status === 'rejected' ? 'user_rejected' : undefined,
    })
    toast({ title: `User ${status}`, variant: 'success' })
    fetchUsers()
  }

  // "based on the role their UI will change automatically" — this is the
  // one control point for that: an admin moves a person between
  // recruiter/leadership/admin here, and every RLS policy + frontend
  // gate (Sidebar, RequireLeadership, Requirements columns, Clients/
  // Vendors access) reads from this same profiles.role value.
  const updateRole = async (user: Profile, role: string) => {
    if (role === user.role) return
    if (!window.confirm(`Change ${user.full_name}'s role from ${user.role.replace('_', ' ')} to ${role.replace('_', ' ')}?`)) return
    const { error } = await supabase.from('profiles').update({ role }).eq('id', user.id)
    if (error) {
      toast({ title: 'Could not update role', description: error.message, variant: 'destructive' })
      return
    }
    await logActivity({ module: 'Users', action: 'Changed role', details: `${user.full_name}: ${user.role} → ${role}`, recordId: user.id, activityType: 'role_changed' })
    toast({ title: 'Role updated', variant: 'success' })
    fetchUsers()
  }

  const [resettingId, setResettingId] = useState<string | null>(null)

  const resetPassword = async (user: Profile) => {
    if (!window.confirm(`Reset ${user.full_name}'s password? Their current password will stop working immediately and they'll get an email to set a new one.`)) return
    setResettingId(user.id)
    try {
      // Server-side function using the service-role key — see
      // supabase/functions/admin-reset-password/index.ts. This is the
      // genuine admin-triggered reset (works for ANY account: recruiter,
      // leadership, or admin), unlike resetPasswordForEmail which only
      // supports a user requesting their own reset.
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { targetUserId: user.id },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error ?? error?.message ?? 'Unknown error')
      }
      await logActivity({ module: 'Users', action: 'Reset password', details: user.full_name, recordId: user.id, activityType: 'password_reset' })
      toast({ title: 'Password reset', description: `${user.full_name} will receive an email to set a new password.`, variant: 'success' })
    } catch (err: any) {
      toast({ title: 'Could not reset password', description: err?.message, variant: 'destructive' })
    } finally {
      setResettingId(null)
    }
  }

  const pending = users.filter(u => u.status === 'pending')

  const columns: ColumnDef<Profile>[] = [
    {
      accessorKey: 'full_name', header: 'Name',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setProfileCardUserId(row.original.id)}
          className="flex items-center gap-2 hover:underline text-left"
        >
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
            {row.original.full_name?.charAt(0)?.toUpperCase()}
          </div>
          <span className="font-medium">{row.original.full_name}</span>
        </button>
      ),
    },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => <span className="text-xs">{row.original.email}</span> },
    {
      accessorKey: 'role', header: 'Role',
      cell: ({ row }) => {
        const u = row.original
        return (
          <div className="flex items-center gap-1.5">
            {u.role === 'admin' && <Shield className="h-3 w-3 text-primary flex-shrink-0" />}
            {u.role === 'leadership' && <Briefcase className="h-3 w-3 text-primary flex-shrink-0" />}
            <select
              value={u.role}
              onChange={e => updateRole(u, e.target.value)}
              className="text-sm capitalize bg-transparent border rounded-md px-1.5 py-0.5 hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        )
      },
    },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => (
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", getStatusBadgeClass(row.original.status))}>
          {row.original.status}
        </span>
      ),
    },
    { accessorKey: 'created_at', header: 'Registered', cell: ({ row }) => formatDateTime(row.original.created_at) },
    {
      id: 'actions', header: 'Actions',
      cell: ({ row }) => {
        const u = row.original
        return (
          <div className="flex items-center gap-1">
            {u.status === 'pending' && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title="Approve" aria-label="Approve" onClick={() => updateStatus(u, 'approved')}>
                  <CheckCircle className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Reject" aria-label="Reject" onClick={() => updateStatus(u, 'rejected')}>
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {u.status === 'approved' && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" title="Deactivate" aria-label="Deactivate" onClick={() => updateStatus(u, 'inactive')}>
                <UserX className="h-3.5 w-3.5" />
              </Button>
            )}
            {(u.status === 'inactive' || u.status === 'rejected') && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title="Activate" aria-label="Activate" onClick={() => updateStatus(u, 'approved')}>
                <UserCheck className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-blue-600" title="Reset Password" aria-label="Reset Password"
              onClick={() => resetPassword(u)} disabled={resettingId === u.id}
            >
              <RotateCcw className={cn("h-3.5 w-3.5", resettingId === u.id && "animate-spin")} />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
            ⚠️ {pending.length} pending approval{pending.length > 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {pending.map(u => (
              <div key={u.id} className="flex items-center gap-2 bg-white dark:bg-amber-900/30 rounded-lg px-3 py-1.5 text-sm border border-amber-200 dark:border-amber-700">
                <span className="font-medium">{u.full_name}</span>
                <span className="text-muted-foreground text-xs">{u.email}</span>
                <Button size="sm" className="h-6 px-2 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => updateStatus(u, 'approved')}>Approve</Button>
                <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={() => updateStatus(u, 'rejected')}>Reject</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="text-sm text-muted-foreground">{users.length} users registered</p>
        </div>
      </div>

      <DataTable data={users} columns={columns} searchPlaceholder="Search users…" />

      <RecruiterProfileCard
        userId={profileCardUserId}
        open={!!profileCardUserId}
        onOpenChange={(open) => { if (!open) setProfileCardUserId(null) }}
      />
    </div>
  )
}
