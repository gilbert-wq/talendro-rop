import React, { useState } from 'react'
import Papa from 'papaparse'
import { Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { logActivity } from '@/lib/activityLogger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/components'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/forms'
import { generateFGId, escapeFilterValue } from '@/lib/utils'

type UploadResult = { success: number; errors: string[] }

function downloadTemplate(type: string) {
  const templates: Record<string, string[][]> = {
    candidates: [['candidate_name', 'mobile_number', 'email_address', 'pan_number', 'current_location', 'total_experience', 'skills', 'current_employer', 'current_ctc', 'expected_ctc', 'notice_period', 'highest_qualification']],
    vendors: [['vendor_name', 'contact_person', 'email', 'mobile', 'location', 'gst_number']],
    clients: [['client_name', 'contact_person', 'email', 'phone', 'industry']],
    requirements: [['fg_id', 'requirement_title', 'category', 'mandatory_skills', 'location', 'openings', 'priority', 'experience_min', 'experience_max']],
  }
  const headers = templates[type]
  if (!headers) return
  const csv = headers.map(row => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `template_${type}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string): Record<string, string>[] {
  // PapaParse correctly handles quoted fields containing commas/newlines and
  // escaped quotes — the previous hand-rolled `line.split(',')` parser
  // silently misaligned every column after any value containing a comma
  // (e.g. an address like "Bangalore, Karnataka" or a name like "Smith, John").
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  })
  return result.data.filter(row => Object.values(row).some(v => v))
}

export function BulkUploadPage() {
  const { user, isLeadership } = useAuth()
  const { toast } = useToast()
  const [results, setResults] = useState<Record<string, UploadResult | null>>({
    candidates: null, vendors: null, clients: null, requirements: null,
  })
  const [uploading, setUploading] = useState<string | null>(null)

  const handleFileUpload = async (type: string, file: File) => {
    setUploading(type)
    setResults(r => ({ ...r, [type]: null }))
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      const success: number[] = []
      const errors: string[] = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        try {
          if (type === 'candidates') {
            if (!row.candidate_name || !row.mobile_number || !row.email_address) {
              errors.push(`Row ${i + 2}: Name, mobile, email required`); continue
            }
            const { data: existing } = await supabase.from('candidates')
              .select('id').or(`mobile_number.eq.${escapeFilterValue(row.mobile_number)},email_address.eq.${escapeFilterValue(row.email_address)}`)
            if (existing && existing.length > 0) {
              errors.push(`Row ${i + 2}: Duplicate — ${row.candidate_name}`); continue
            }
            await supabase.from('candidates').insert({
              candidate_name: row.candidate_name,
              mobile_number: row.mobile_number,
              email_address: row.email_address,
              pan_number: row.pan_number || null,
              current_location: row.current_location || null,
              total_experience: row.total_experience ? Number(row.total_experience) : null,
              skills: row.skills ? row.skills.split(';').map((s: string) => s.trim()) : [],
              current_employer: row.current_employer || null,
              current_ctc: row.current_ctc ? Number(row.current_ctc) : null,
              expected_ctc: row.expected_ctc ? Number(row.expected_ctc) : null,
              notice_period: row.notice_period ? Number(row.notice_period) : null,
              highest_qualification: row.highest_qualification || null,
              created_by: user!.id,
            })
            success.push(i)
          } else if (type === 'vendors') {
            if (!row.vendor_name) { errors.push(`Row ${i + 2}: Vendor name required`); continue }
            await supabase.from('vendors').insert({
              vendor_name: row.vendor_name, contact_person: row.contact_person || null,
              email: row.email || null, mobile: row.mobile || null,
              location: row.location || null, gst_number: row.gst_number || null,
              status: 'active', created_by: user!.id,
            })
            success.push(i)
          } else if (type === 'clients') {
            if (!row.client_name) { errors.push(`Row ${i + 2}: Client name required`); continue }
            await supabase.from('clients').insert({
              client_name: row.client_name, contact_person: row.contact_person || null,
              email: row.email || null, phone: row.phone || null,
              industry: row.industry || null, status: 'active', created_by: user!.id,
            })
            success.push(i)
          } else if (type === 'requirements') {
            if (!row.requirement_title) { errors.push(`Row ${i + 2}: Title required`); continue }
            await supabase.from('requirements').insert({
              fg_id: row.fg_id || generateFGId(),
              requirement_title: row.requirement_title,
              category: row.category || null,
              mandatory_skills: row.mandatory_skills ? row.mandatory_skills.split(';').map((s: string) => s.trim()) : [],
              secondary_skills: [],
              location: row.location || null,
              openings: row.openings ? Number(row.openings) : 1,
              priority: row.priority || 'medium',
              status: 'open',
              experience_min: row.experience_min ? Number(row.experience_min) : null,
              experience_max: row.experience_max ? Number(row.experience_max) : null,
              created_by: user!.id,
            })
            success.push(i)
          }
        } catch (err: any) {
          errors.push(`Row ${i + 2}: ${err.message}`)
        }
      }

      const result = { success: success.length, errors }
      setResults(r => ({ ...r, [type]: result }))
      await logActivity({ module: 'Bulk Upload', action: `Bulk imported ${type}`, details: `${success.length} records` })
      toast({
        title: `Import complete`,
        description: `${success.length} imported, ${errors.length} errors`,
        variant: errors.length === 0 ? 'success' : 'default',
      })
    } finally {
      setUploading(null)
    }
  }

  const allUploadTypes = [
    { id: 'candidates', label: 'Candidates', description: 'Import candidate profiles in bulk' },
    { id: 'vendors', label: 'Vendors', description: 'Import vendor database', leadershipOnly: true },
    { id: 'clients', label: 'Clients', description: 'Import client records', leadershipOnly: true },
    { id: 'requirements', label: 'Requirements', description: 'Import job requirements', leadershipOnly: true },
  ]
  // vendors/clients/requirements inserts are leadership-only via RLS now —
  // hiding these tabs for recruiters avoids every row in those imports
  // failing with a confusing permissions error.
  const uploadTypes = allUploadTypes.filter(t => !t.leadershipOnly || isLeadership)

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bulk Upload Center</h1>
          <p className="text-sm text-muted-foreground">Import data via CSV files</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {uploadTypes.map(({ id, label, description }) => (
          <Card key={id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm">{label} Import</CardTitle>
              </div>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadTemplate(id)} className="flex-1">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download Template
                </Button>
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  id={`upload-${id}`}
                  className="sr-only"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(id, file)
                    e.target.value = ''
                  }}
                  disabled={!!uploading}
                />
                <label htmlFor={`upload-${id}`} className="cursor-pointer">
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {uploading === id ? 'Processing…' : 'Click to upload CSV'}
                  </p>
                </label>
              </div>

              {results[id] && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    {results[id]!.success} records imported successfully
                  </div>
                  {results[id]!.errors.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        {results[id]!.errors.length} errors:
                      </div>
                      <div className="max-h-24 overflow-y-auto space-y-0.5">
                        {results[id]!.errors.map((err, i) => (
                          <p key={i} className="text-xs text-destructive bg-destructive/10 rounded px-2 py-0.5">{err}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">CSV Format Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              <p className="font-semibold text-foreground mb-1">Candidates CSV</p>
              <ul className="space-y-0.5">
                <li>• Use semicolons (;) to separate multiple skills</li>
                <li>• CTC values in absolute numbers (e.g. 1200000)</li>
                <li>• Notice period in days</li>
                <li>• Mobile and email must be unique</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Requirements CSV</p>
              <ul className="space-y-0.5">
                <li>• FG ID auto-generated if empty</li>
                <li>• Use semicolons (;) for multiple skills</li>
                <li>• Priority: low / medium / high / urgent</li>
                <li>• Experience in years (decimal ok)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
