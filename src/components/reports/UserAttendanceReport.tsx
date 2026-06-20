import React, { useEffect, useMemo, useState } from 'react'
import { Download, Users as UsersIcon, UserCheck, UserX, Clock, Timer, Wifi } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/components'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/forms'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/components'
import { attendanceService } from '@/lib/userInsightsService'
import { exportToCSV, exportToExcel, exportToPDF, buildTableHTML } from '@/lib/exports'
import { formatDateTime } from '@/lib/utils'
import type { AttendanceRecord } from '@/types'

type FilterPreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

function getRange(preset: FilterPreset, customStart: string, customEnd: string): { start: string; end: string } {
  const today = new Date()
  const toISO = (d: Date) => d.toISOString().split('T')[0]

  switch (preset) {
    case 'today':
      return { start: toISO(today), end: toISO(today) }
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1)
      return { start: toISO(y), end: toISO(y) }
    }
    case 'week': {
      const start = new Date(today); start.setDate(start.getDate() - start.getDay())
      return { start: toISO(start), end: toISO(today) }
    }
    case 'month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: toISO(start), end: toISO(today) }
    }
    case 'custom':
      return { start: customStart || toISO(today), end: customEnd || toISO(today) }
  }
}

/** FEATURE 6: User Attendance Management — admin-only, mounted as a tab
 * inside ReportsPage (matches "Reports → User Attendance" navigation from
 * the spec without inventing a separate nested-menu mechanism the rest of
 * the app's Sidebar doesn't otherwise use). */
export function UserAttendanceReport() {
  const [preset, setPreset] = useState<FilterPreset>('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [rows, setRows] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { start, end } = useMemo(() => getRange(preset, customStart, customEnd), [preset, customStart, customEnd])

  useEffect(() => {
    setLoading(true)
    attendanceService.getReport(start, end).then(({ data, error }) => {
      if (error) { setError(error.message); setRows([]) }
      else {
        setError(null)
        setRows((data ?? []).map((r: any) => ({
          ...r,
          status: r.is_currently_online ? 'online' : 'offline',
        })))
      }
      setLoading(false)
    })
  }, [start, end])

  const todayStr = new Date().toISOString().split('T')[0]
  const todayRows = rows.filter(r => r.attendance_date === todayStr)
  const totalEmployees = new Set(rows.map(r => r.user_id)).size
  const presentToday = new Set(todayRows.filter(r => r.first_login).map(r => r.user_id)).size
  const absentToday = Math.max(0, totalEmployees - presentToday)
  const activeNow = todayRows.filter(r => r.status === 'online').length
  const avgWorkingMinutes = todayRows.length
    ? Math.round(todayRows.reduce((sum, r) => sum + r.total_duration_minutes, 0) / Math.max(1, presentToday))
    : 0
  const avgLoginTime = (() => {
    const logins = todayRows.filter(r => r.first_login).map(r => new Date(r.first_login!).getTime())
    if (!logins.length) return '—'
    const avgMs = logins.reduce((a, b) => a + b, 0) / logins.length
    return new Date(avgMs).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  })()

  const exportRows = rows.map(r => ({
    'Employee Name': r.full_name,
    'Employee ID': r.employee_id ?? '',
    'Role': r.role,
    'Department': r.department ?? '',
    'Date': r.attendance_date,
    'First Login': r.first_login ? formatDateTime(r.first_login) : '—',
    'Last Logout': r.last_logout ? formatDateTime(r.last_logout) : '—',
    'Total Duration (min)': r.total_duration_minutes,
    'Status': r.status === 'online' ? 'Online' : 'Offline',
  }))

  const handlePDF = () => {
    const headers = ['Employee', 'ID', 'Role', 'Department', 'Date', 'First Login', 'Last Logout', 'Duration', 'Status']
    const tableRows = rows.map(r => [
      r.full_name, r.employee_id ?? '—', r.role, r.department ?? '—', r.attendance_date,
      r.first_login ? formatDateTime(r.first_login) : '—',
      r.last_logout ? formatDateTime(r.last_logout) : '—',
      `${Math.floor(r.total_duration_minutes / 60)}h ${r.total_duration_minutes % 60}m`,
      r.status === 'online' ? '🟢 Online' : '🔴 Offline',
    ])
    exportToPDF('User Attendance Report', buildTableHTML(headers, tableRows))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={v => setPreset(v as FilterPreset)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {preset === 'custom' && (
            <>
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-36" />
              <span className="text-muted-foreground text-xs">to</span>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-36" />
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCSV(exportRows, 'user_attendance')}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToExcel(exportRows, 'user_attendance', 'Attendance')}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePDF}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: UsersIcon, label: 'Total Employees', value: totalEmployees },
          { icon: UserCheck, label: 'Present Today', value: presentToday, accent: 'text-emerald-600' },
          { icon: UserX, label: 'Absent Today', value: absentToday, accent: 'text-red-600' },
          { icon: Clock, label: 'Avg Login Time', value: avgLoginTime },
          { icon: Timer, label: 'Avg Working Hrs', value: `${Math.floor(avgWorkingMinutes / 60)}h ${avgWorkingMinutes % 60}m` },
          { icon: Wifi, label: 'Active Now', value: activeNow, accent: 'text-emerald-600' },
        ].map((c, i) => (
          <Card key={i}>
            <CardContent className="p-3">
              <c.icon className="h-3.5 w-3.5 text-muted-foreground mb-1" />
              <p className={`text-lg font-bold ${c.accent ?? ''}`}>{c.value}</p>
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : error ? (
            <p className="text-sm text-destructive p-4">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No attendance records for this period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-[11px] text-muted-foreground uppercase tracking-wide">
                    <th className="text-left p-2.5">Employee</th>
                    <th className="text-left p-2.5">Emp. ID</th>
                    <th className="text-left p-2.5">Role</th>
                    <th className="text-left p-2.5">Department</th>
                    <th className="text-left p-2.5">Date</th>
                    <th className="text-left p-2.5">First Login</th>
                    <th className="text-left p-2.5">Last Logout</th>
                    <th className="text-left p-2.5">Duration</th>
                    <th className="text-left p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.user_id}-${r.attendance_date}`} className={i % 2 ? 'bg-muted/30' : ''}>
                      <td className="p-2.5 font-medium">{r.full_name}</td>
                      <td className="p-2.5">{r.employee_id ?? '—'}</td>
                      <td className="p-2.5 capitalize">{r.role}</td>
                      <td className="p-2.5">{r.department ?? '—'}</td>
                      <td className="p-2.5">{r.attendance_date}</td>
                      <td className="p-2.5">{r.first_login ? formatDateTime(r.first_login) : '—'}</td>
                      <td className="p-2.5">{r.last_logout ? formatDateTime(r.last_logout) : '—'}</td>
                      <td className="p-2.5">{Math.floor(r.total_duration_minutes / 60)}h {r.total_duration_minutes % 60}m</td>
                      <td className="p-2.5">
                        {r.status === 'online' ? (
                          <span className="text-emerald-600">🟢 Online</span>
                        ) : (
                          <span className="text-red-600">🔴 Offline</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
