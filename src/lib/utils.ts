import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatCTC(ctc: number | null | undefined): string {
  if (ctc == null) return '—'
  if (ctc >= 100000) return `₹${(ctc / 100000).toFixed(1)}L`
  return `₹${ctc.toLocaleString('en-IN')}`
}

export function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    sourced: 'badge-sourced',
    submitted: 'badge-submitted',
    shortlisted: 'badge-shortlisted',
    interview_scheduled: 'badge-interview',
    l1_cleared: 'badge-interview',
    l2_cleared: 'badge-interview',
    final_round: 'badge-interview',
    offered: 'badge-offered',
    joined: 'badge-joined',
    rejected: 'badge-rejected',
    open: 'badge-open',
    hold: 'badge-hold',
    closed: 'badge-closed',
    filled: 'badge-filled',
    pending: 'badge-pending',
    approved: 'badge-approved',
    active: 'badge-active',
    inactive: 'badge-inactive',
    low: 'badge-submitted',
    medium: 'badge-shortlisted',
    high: 'badge-offered',
    urgent: 'badge-rejected',
  }
  return map[status] ?? 'badge-sourced'
}

export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    sourced: 'Sourced',
    submitted: 'Submitted',
    shortlisted: 'Shortlisted',
    interview_scheduled: 'Interview Scheduled',
    l1_cleared: 'L1 Cleared',
    l2_cleared: 'L2 Cleared',
    final_round: 'Final Round',
    offered: 'Offered',
    joined: 'Joined',
    rejected: 'Rejected',
    open: 'Open',
    hold: 'Hold',
    closed: 'Closed',
    filled: 'Filled',
    pending: 'Pending Approval',
    approved: 'Approved',
    active: 'Active',
    inactive: 'Inactive',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
    cleared: 'Cleared',
    on_hold: 'On Hold',
    accepted: 'Accepted',
    declined: 'Declined',
    no_show: 'No Show',
  }
  return map[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function generateFGId(): string {
  const year = new Date().getFullYear().toString().slice(-2)
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  return `FG${year}JP${random}`
}

export function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function truncate(str: string, len = 40): string {
  return str.length > len ? str.slice(0, len) + '…' : str
}
