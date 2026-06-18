import React, { useEffect, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { CheckCircle, XCircle, UserX, UserCheck, RotateCcw, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/useToast'
import { logActivity } from '@/lib/activityLogger'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
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

export function UsersPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }

  const updateStatus = async (user: Profile, status: string) => {
    await supabase.from('profiles').update({ status }).eq('id', user.id)
    await logActivity({ module: 'Users', action: `${status} recruiter`, details: user.full_name, recordId: user.id })
    toast({ title: `User ${status}`, variant: 'success' })
    fetchUsers()
  }

  const resetPassword = async (user: Profile) => {
    // SECURITY: supabase.auth.admin.* requires the service-role key and must
    // never be called from a browser client (the anon key this app ships
    // with cannot actually authorize it). The previous code called it
    // anyway and silently relied on this fallback succeeding — a landmine,
    // since "fixing" the failing admin call by adding a service-role key to
    // a VITE_* env var would leak full database-bypass credentials to every
    // visitor. resetPasswordForEmail is the correct, client-safe API.
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      toast({ title: 'Could not send reset email', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Password reset email sent', variant: 'success' })
  }

  const pending = users.filter(u => u.status === 'pending')

  const columns: ColumnDef<Profile>[] = [
    {
      accessorKey: 'full_name', header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
            {row.original.full_name?.charAt(0)?.toUpperCase()}
          </div>
          <span className="font-medium">{row.original.full_name}</span>
        </div>
      ),
    },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => <span className="text-xs">{row.original.email}</span> },
    {
      accessorKey: 'role', header: 'Role',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.role === 'admin' && <Shield className="h-3 w-3 text-primary" />}
          <span className="text-sm capitalize">{row.original.role}</span>
        </div>
      ),
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
            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" title="Reset Password" aria-label="Reset Password" onClick={() => resetPassword(u)}>
              <RotateCcw className="h-3.5 w-3.5" />
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
    </div>
  )
}
