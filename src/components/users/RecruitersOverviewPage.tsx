import React, { useEffect, useState } from 'react'
import { Briefcase, Eye } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/components'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { formatDate, cn, getStatusBadgeClass } from '@/lib/utils'
import { RecruiterProfileCard } from './RecruiterProfileCard'
import type { ColumnDef } from '@tanstack/react-table'

interface RecruiterRow {
  id: string
  full_name: string
  email: string
  department: string | null
  designation: string | null
  status: string
  active_requirements: number
}

/** Leadership-only ("Business Head flow"): browse recruiters and open the
 * same RecruiterProfileCard the admin Users page uses — addresses "view
 * recruiter profile access should be given to Leadership role". This page
 * is separate from admin's User Management (which also handles account
 * approval/role changes, a system-administration function the leadership
 * doesn't get) and is where assigning a requirement to a recruiter is most
 * naturally surfaced as context, even though the actual assignment action
 * lives on the Requirements page itself. */
export function RecruitersOverviewPage() {
  const [recruiters, setRecruiters] = useState<RecruiterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [profileCardUserId, setProfileCardUserId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: profiles }, { data: reqs }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, department, designation, status').eq('role', 'recruiter'),
      supabase.from('requirements').select('assigned_to').eq('status', 'open').not('assigned_to', 'is', null),
    ])
    const countByRecruiter: Record<string, number> = {}
    ;(reqs ?? []).forEach((r: any) => { countByRecruiter[r.assigned_to] = (countByRecruiter[r.assigned_to] ?? 0) + 1 })
    setRecruiters((profiles ?? []).map((p: any) => ({ ...p, active_requirements: countByRecruiter[p.id] ?? 0 })))
    setLoading(false)
  }

  const columns: ColumnDef<RecruiterRow>[] = [
    {
      accessorKey: 'full_name', header: 'Name',
      cell: ({ row }) => (
        <button onClick={() => setProfileCardUserId(row.original.id)} className="flex items-center gap-2 hover:underline text-left">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
            {row.original.full_name?.charAt(0)?.toUpperCase()}
          </div>
          <span className="font-medium">{row.original.full_name}</span>
        </button>
      ),
    },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'department', header: 'Department', cell: ({ row }) => row.original.department ?? '—' },
    { accessorKey: 'designation', header: 'Designation', cell: ({ row }) => row.original.designation ?? '—' },
    {
      accessorKey: 'active_requirements', header: 'Active Assignments',
      cell: ({ row }) => <span className="font-semibold">{row.original.active_requirements}</span>,
    },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => (
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize", getStatusBadgeClass(row.original.status))}>
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => setProfileCardUserId(row.original.id)}>
          <Eye className="h-3.5 w-3.5 mr-1.5" /> View Profile
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Briefcase className="h-5 w-5" /> Recruiters</h1>
          <p className="text-sm text-muted-foreground">{recruiters.length} recruiters · click a name to view their full profile, performance, and workload</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable data={recruiters} columns={columns} searchPlaceholder="Search recruiters…" />
        </CardContent>
      </Card>

      <RecruiterProfileCard
        userId={profileCardUserId}
        open={!!profileCardUserId}
        onOpenChange={(open) => { if (!open) setProfileCardUserId(null) }}
      />
    </div>
  )
}
