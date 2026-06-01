import React, { useEffect, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Activity, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { formatDateTime, downloadCSV } from '@/lib/utils'

interface LogEntry {
  id: string
  user_name: string
  role: string
  module: string
  action: string
  details: string | null
  record_id: string | null
  created_at: string
}

export function ActivityPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchLogs() }, [])

  const fetchLogs = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    setLogs(data ?? [])
    setLoading(false)
  }

  const columns: ColumnDef<LogEntry>[] = [
    {
      accessorKey: 'created_at', header: 'Date & Time',
      cell: ({ row }) => <span className="text-xs mono">{formatDateTime(row.original.created_at)}</span>,
    },
    {
      accessorKey: 'user_name', header: 'User',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
            {row.original.user_name?.charAt(0)?.toUpperCase()}
          </div>
          <span className="text-sm font-medium">{row.original.user_name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'role', header: 'Role',
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-full bg-secondary/50 px-2 py-0.5 text-xs capitalize">
          {row.original.role}
        </span>
      ),
    },
    {
      accessorKey: 'module', header: 'Module',
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
          {row.original.module}
        </span>
      ),
    },
    { accessorKey: 'action', header: 'Action', cell: ({ row }) => <span className="text-sm">{row.original.action}</span> },
    {
      accessorKey: 'details', header: 'Details',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.details ?? '—'}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Activity Logs
          </h1>
          <p className="text-sm text-muted-foreground">{logs.length} recent actions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadCSV(logs as any[], 'activity_logs')}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Export
        </Button>
      </div>

      <DataTable data={logs} columns={columns} searchPlaceholder="Search logs…" />
    </div>
  )
}
