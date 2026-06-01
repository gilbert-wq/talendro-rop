import * as XLSX from 'xlsx'
import { formatDate, formatCTC, formatStatus } from './utils'
import type { Submission, Candidate, Requirement, Interview, Offer } from '@/types'

// ─── CSV Export ───────────────────────────────────────────────────────────────
export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const v = row[h]
      if (v === null || v === undefined) return ''
      if (Array.isArray(v)) return v.join('; ')
      return String(v).includes(',') ? `"${String(v).replace(/"/g, '""')}"` : String(v)
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  downloadFile(csv, `${filename}_${today()}.csv`, 'text/csv')
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
export function exportToExcel(data: Record<string, unknown>[], filename: string, sheetName = 'Data') {
  if (!data.length) return
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  // Auto column widths
  const cols = Object.keys(data[0]).map(k => ({
    wch: Math.max(k.length, ...data.map(r => String(r[k] ?? '').length).slice(0, 20)) + 2
  }))
  ws['!cols'] = cols
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}_${today()}.xlsx`)
}

// ─── Submission Tracker Export ────────────────────────────────────────────────
export function exportSubmissionTracker(submissions: Submission[]) {
  const rows = submissions.map(s => ({
    'Submission Date': s.submission_date,
    'FG ID': s.requirements?.fg_id ?? '',
    'Client': (s.requirements as any)?.clients?.client_name ?? '',
    'Position': s.requirements?.requirement_title ?? '',
    'Partner / Vendor': s.partner_name ?? '',
    'Candidate Name': s.candidates?.candidate_name ?? '',
    'Contact Number': s.candidates?.mobile_number ?? '',
    'Email': s.candidates?.email_address ?? '',
    'Experience (yrs)': s.candidates?.total_experience ?? '',
    'Current Location': s.candidates?.current_location ?? '',
    'Preferred Location': s.candidates?.preferred_location ?? '',
    'Official Notice Period (days)': s.candidates?.notice_period ?? '',
    'Can Join Within (days)': s.candidates?.can_join_within ?? '',
    'PAN Number': s.candidates?.pan_number ?? '',
    'Date of Birth': s.candidates?.date_of_birth ?? '',
    'Highest Education': s.candidates?.highest_qualification ?? '',
    'University Name': s.candidates?.university ?? '',
    'Year of Passing': s.candidates?.passing_year ?? '',
    'Current Employer': s.candidates?.current_employer ?? '',
    'Current CTC': s.candidates?.current_ctc ?? '',
    'Expected CTC': s.candidates?.expected_ctc ?? '',
    'Skills': (s.candidates?.skills ?? []).join('; '),
    'Status': formatStatus(s.status),
    'Notes': s.notes ?? '',
  }))
  exportToExcel(rows, 'submission_tracker', 'Submissions')
}

// ─── Candidate Report Export ──────────────────────────────────────────────────
export function exportCandidateReport(candidates: Candidate[]) {
  const rows = candidates.map(c => ({
    'Candidate Name': c.candidate_name,
    'Mobile': c.mobile_number,
    'Email': c.email_address,
    'PAN': c.pan_number ?? '',
    'DOB': c.date_of_birth ?? '',
    'Current Location': c.current_location ?? '',
    'Preferred Location': c.preferred_location ?? '',
    'Total Experience': c.total_experience ?? '',
    'Relevant Experience': c.relevant_experience ?? '',
    'Skills': c.skills.join('; '),
    'Current Employer': c.current_employer ?? '',
    'Current CTC': c.current_ctc ?? '',
    'Expected CTC': c.expected_ctc ?? '',
    'Notice Period (days)': c.notice_period ?? '',
    'Can Join Within (days)': c.can_join_within ?? '',
    'Highest Qualification': c.highest_qualification ?? '',
    'University': c.university ?? '',
    'Passing Year': c.passing_year ?? '',
    'Added On': formatDate(c.created_at),
  }))
  exportToExcel(rows, 'candidate_report', 'Candidates')
}

// ─── Requirement Report Export ────────────────────────────────────────────────
export function exportRequirementReport(requirements: Requirement[]) {
  const rows = requirements.map(r => ({
    'FG ID': r.fg_id,
    'Client': r.clients?.client_name ?? '',
    'Position': r.requirement_title,
    'Category': r.category ?? '',
    'Mandatory Skills': r.mandatory_skills.join('; '),
    'Secondary Skills': r.secondary_skills.join('; '),
    'Experience Min': r.experience_min ?? '',
    'Experience Max': r.experience_max ?? '',
    'Location': r.location ?? '',
    'Openings': r.openings,
    'Priority': r.priority,
    'Status': r.status,
    'Created': formatDate(r.created_at),
  }))
  exportToExcel(rows, 'requirement_report', 'Requirements')
}

// ─── Interview Report Export ──────────────────────────────────────────────────
export function exportInterviewReport(interviews: Interview[]) {
  const rows = interviews.map(iv => ({
    'Date': iv.interview_date,
    'Time': iv.interview_time ?? '',
    'Candidate': iv.candidates?.candidate_name ?? '',
    'Contact': iv.candidates?.mobile_number ?? '',
    'FG ID': iv.requirements?.fg_id ?? '',
    'Position': iv.requirements?.requirement_title ?? '',
    'Round': iv.interview_round,
    'Mode': iv.interview_mode,
    'Interviewer': iv.interviewer ?? '',
    'Result': iv.result,
    'Feedback': iv.feedback ?? '',
  }))
  exportToExcel(rows, 'interview_report', 'Interviews')
}

// ─── Offer Report Export ──────────────────────────────────────────────────────
export function exportOfferReport(offers: Offer[]) {
  const rows = offers.map(o => ({
    'Offer Date': o.offer_date ?? '',
    'Candidate': o.candidates?.candidate_name ?? '',
    'Contact': o.candidates?.mobile_number ?? '',
    'Email': o.candidates?.email_address ?? '',
    'FG ID': o.requirements?.fg_id ?? '',
    'Position': o.requirements?.requirement_title ?? '',
    'Offered CTC': o.offered_ctc ?? '',
    'Joining Date': o.joining_date ?? '',
    'Status': o.status,
    'Notes': o.notes ?? '',
  }))
  exportToExcel(rows, 'offer_report', 'Offers')
}

// ─── PDF Export (simple HTML-to-print approach) ───────────────────────────────
export function exportToPDF(title: string, content: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 32px; color: #1e293b; }
        .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; border-bottom: 2px solid #1e3a8a; padding-bottom: 16px; }
        .header-text h1 { margin: 0; color: #1e3a8a; font-size: 20px; }
        .header-text p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 16px; }
        th { background: #1e3a8a; color: white; padding: 6px 8px; text-align: left; }
        td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) td { background: #f8fafc; }
        .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; }
        @media print { @page { margin: 1cm; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-text">
          <h1>Talendro ROP — ${title}</h1>
          <p>Generated on ${new Date().toLocaleString('en-IN')} | Talendro Solutions</p>
        </div>
      </div>
      ${content}
      <div class="footer">Talendro ROP • Confidential • Talendro Solutions</div>
    </body>
    </html>
  `
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 500)
}

export function buildTableHTML(headers: string[], rows: string[][]): string {
  return `
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function today(): string {
  return new Date().toISOString().split('T')[0]
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
