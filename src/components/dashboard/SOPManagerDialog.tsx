import React, { useEffect, useState } from 'react'
import { Upload, Trash2, FileText, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/forms'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label, Skeleton } from '@/components/ui/components'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { logActivity } from '@/lib/activityLogger'
import { companySopService } from '@/lib/userInsightsService'
import { formatDate } from '@/lib/utils'
import type { CompanySOP } from '@/types'

interface SOPManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** FEATURE 5: admin-only SOP upload/management. Separate from
 * SOPViewerDialog (which any approved user gets) — this is the
 * publish/delete side, gated by company_sops' admin-only insert/delete RLS
 * regardless of whether this dialog itself is reachable from the UI. */
export function SOPManagerDialog({ open, onOpenChange }: SOPManagerDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [sops, setSops] = useState<CompanySOP[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const load = () => {
    setLoading(true)
    companySopService.getAll().then(({ data }) => { setSops(data ?? []); setLoading(false) })
  }

  useEffect(() => { if (open) load() }, [open])

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast({ title: 'Title and file are required', variant: 'destructive' })
      return
    }
    setUploading(true)
    const { error } = await companySopService.upload(file, title.trim(), description.trim() || null, user!.id)
    setUploading(false)
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' })
      return
    }
    await logActivity({ module: 'Company SOPs', action: 'Uploaded SOP', details: title.trim(), activityType: 'sop_uploaded' })
    toast({ title: 'SOP published', variant: 'success' })
    setTitle(''); setDescription(''); setFile(null)
    load()
  }

  const handleDelete = async (sop: CompanySOP) => {
    await companySopService.delete(sop)
    await logActivity({ module: 'Company SOPs', action: 'Deleted SOP', details: sop.title, activityType: 'sop_deleted' })
    toast({ title: 'SOP removed', variant: 'success' })
    load()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Company SOPs</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Candidate Submission SOP" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional short description" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">File * (PDF, Word, or PowerPoint)</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="w-full" size="sm">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            {uploading ? 'Uploading…' : 'Publish SOP'}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Published SOPs</p>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : sops.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nothing published yet</p>
          ) : (
            sops.map(sop => (
              <div key={sop.id} className="flex items-center gap-3 p-2.5 rounded-lg border">
                <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{sop.title}</p>
                  <p className="text-[11px] text-muted-foreground">Published {formatDate(sop.created_at)}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(sop)} aria-label="Delete SOP" title="Delete SOP">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
