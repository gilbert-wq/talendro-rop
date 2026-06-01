import React, { useEffect, useState } from 'react'
import { Clock, ArrowRight, User } from 'lucide-react'
import { stageHistoryService, candidateNotesService, candidateDocumentsService } from '@/lib/services'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/components'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/forms'
import { formatDateTime, formatDate, getStatusBadgeClass, cn } from '@/lib/utils'
import type { CandidateStageHistory, CandidateNote, CandidateDocument } from '@/types'

interface Props {
  candidateId: string
  candidateName: string
}

const DOC_TYPES = [
  { value: 'resume', label: 'Resume' },
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'id_proof', label: 'ID Proof' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
]

export function CandidateTimeline({ candidateId, candidateName }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [history, setHistory] = useState<CandidateStageHistory[]>([])
  const [notes, setNotes] = useState<CandidateNote[]>([])
  const [docs, setDocs] = useState<CandidateDocument[]>([])
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [docType, setDocType] = useState('other')

  useEffect(() => {
    fetchAll()
  }, [candidateId])

  const fetchAll = async () => {
    const [{ data: h }, { data: n }, { data: d }] = await Promise.all([
      stageHistoryService.getByCandidateId(candidateId),
      candidateNotesService.getByCandidateId(candidateId),
      candidateDocumentsService.getByCandidateId(candidateId),
    ])
    setHistory(h ?? [])
    setNotes(n ?? [])
    setDocs(d ?? [])
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || !user) return
    setAddingNote(true)
    await candidateNotesService.create(candidateId, newNote.trim(), user.id)
    setNewNote('')
    fetchAll()
    toast({ title: 'Note added', variant: 'success' })
    setAddingNote(false)
  }

  const handleDeleteNote = async (noteId: string) => {
    await candidateNotesService.delete(noteId)
    fetchAll()
    toast({ title: 'Note deleted', variant: 'success' })
  }

  const handleDocUpload = async (file: File) => {
    if (!user) return
    setUploadingDoc(true)
    const { data, error } = await candidateDocumentsService.upload(candidateId, file, docType, user.id)
    if (error) {
      toast({ title: 'Upload failed', variant: 'destructive' })
    } else {
      toast({ title: 'Document uploaded', variant: 'success' })
      fetchAll()
    }
    setUploadingDoc(false)
  }

  const handleDeleteDoc = async (doc: CandidateDocument) => {
    if (!confirm(`Delete document "${doc.document_name}"?`)) return
    await candidateDocumentsService.delete(doc)
    fetchAll()
    toast({ title: 'Document deleted', variant: 'success' })
  }

  return (
    <Tabs defaultValue="timeline">
      <TabsList>
        <TabsTrigger value="timeline">Stage History ({history.length})</TabsTrigger>
        <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
        <TabsTrigger value="documents">Documents ({docs.length})</TabsTrigger>
      </TabsList>

      {/* Stage History Timeline */}
      <TabsContent value="timeline">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Clock className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No stage history yet</p>
          </div>
        ) : (
          <div className="relative space-y-0 mt-4">
            {history.map((entry, i) => (
              <div key={entry.id} className="flex gap-4 pb-4">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-primary flex-shrink-0 mt-0.5 ring-4 ring-primary/20" />
                  {i < history.length - 1 && <div className="w-px flex-1 bg-border mt-1 min-h-4" />}
                </div>
                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.from_status && (
                      <>
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", getStatusBadgeClass(entry.from_status))}>
                          {entry.from_status.replace(/_/g, ' ')}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      </>
                    )}
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", getStatusBadgeClass(entry.to_status))}>
                      {entry.to_status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{(entry as any).profiles?.full_name ?? 'System'}</span>
                    <span>·</span>
                    <span>{formatDateTime(entry.created_at)}</span>
                  </div>
                  {entry.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{entry.notes}"</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      {/* Notes */}
      <TabsContent value="notes" className="space-y-3 mt-4">
        <div className="space-y-2">
          <Textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Add a note about this candidate…"
            rows={3}
          />
          <Button size="sm" onClick={handleAddNote} disabled={addingNote || !newNote.trim()}>
            {addingNote ? 'Adding…' : 'Add Note'}
          </Button>
        </div>

        <div className="space-y-2">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
          ) : notes.map(note => (
            <div key={note.id} className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm">{note.note}</p>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0 text-xs"
                >
                  ×
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                <span>{(note as any).profiles?.full_name ?? '—'}</span>
                <span>·</span>
                <span>{formatDateTime(note.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </TabsContent>

      {/* Documents */}
      <TabsContent value="documents" className="space-y-3 mt-4">
        <div className="flex gap-2 items-center">
          <select
            value={docType}
            onChange={e => setDocType(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm flex-1"
          >
            {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="cursor-pointer">
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
              disabled={uploadingDoc}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleDocUpload(file)
                e.target.value = ''
              }}
            />
            <div className="h-9 px-3 rounded-lg border border-input bg-background flex items-center text-sm hover:bg-muted transition-colors cursor-pointer whitespace-nowrap">
              {uploadingDoc ? 'Uploading…' : '+ Upload Document'}
            </div>
          </label>
        </div>

        <div className="space-y-2">
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded</p>
          ) : docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                {doc.document_name.split('.').pop()?.toUpperCase().slice(0, 3)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.document_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{doc.document_type.replace(/_/g, ' ')} · {formatDate(doc.created_at)}</p>
              </div>
              <div className="flex gap-1">
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline px-2 py-1 rounded"
                >
                  View
                </a>
                <button
                  onClick={() => handleDeleteDoc(doc)}
                  className="text-xs text-destructive hover:underline px-2 py-1 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  )
}
