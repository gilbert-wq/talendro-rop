import React, { useEffect, useState } from 'react'
import { FileText, ExternalLink, ArrowLeft } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/forms'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/components'
import { companySopService } from '@/lib/userInsightsService'
import { formatDate } from '@/lib/utils'
import type { CompanySOP } from '@/types'

interface SOPViewerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** FEATURE 6: SOPs open in a compact popup for any approved user (not just
 * admins) — list view first, then an embedded preview (PDFs render natively
 * in an iframe; other doc types fall back to "open in new tab" via a fresh
 * signed URL, since browsers can't preview .docx/.pptx inline). */
export function SOPViewerDialog({ open, onOpenChange }: SOPViewerDialogProps) {
  const [sops, setSops] = useState<CompanySOP[]>([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<{ sop: CompanySOP; url: string } | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  useEffect(() => {
    if (!open) { setViewing(null); return }
    setLoading(true)
    companySopService.getAll().then(({ data }) => { setSops(data ?? []); setLoading(false) })
  }, [open])

  const isPdf = (path: string) => path.toLowerCase().endsWith('.pdf')

  const handleView = async (sop: CompanySOP) => {
    setOpening(sop.id)
    const { url, error } = await companySopService.getSignedUrl(sop.file_path)
    setOpening(null)
    if (error || !url) return
    if (isPdf(sop.file_path)) {
      setViewing({ sop, url })
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {viewing && (
              <button onClick={() => setViewing(null)} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {viewing ? viewing.sop.title : 'Company SOPs'}
          </DialogTitle>
        </DialogHeader>

        {viewing ? (
          <div className="space-y-2">
            <iframe src={viewing.url} className="w-full h-[60vh] rounded-lg border" title={viewing.sop.title} />
            <a href={viewing.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Open in new tab
            </a>
          </div>
        ) : loading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : sops.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No SOPs have been published yet</p>
        ) : (
          <div className="space-y-2">
            {sops.map(sop => (
              <button
                key={sop.id}
                onClick={() => handleView(sop)}
                disabled={opening === sop.id}
                className="w-full flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
              >
                <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{sop.title}</p>
                  {sop.description && <p className="text-xs text-muted-foreground mt-0.5">{sop.description}</p>}
                  <p className="text-[11px] text-muted-foreground/70 mt-1">Published {formatDate(sop.created_at)}</p>
                </div>
                {opening === sop.id ? (
                  <span className="text-xs text-muted-foreground flex-shrink-0">Opening…</span>
                ) : (
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
