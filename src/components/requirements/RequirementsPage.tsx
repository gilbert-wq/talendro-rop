import React, { useEffect, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, Trash2, Download, Upload, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { logActivity } from '@/lib/activityLogger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label, Textarea } from '@/components/ui/components'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/forms'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/forms'
import { DataTable } from '@/components/ui/data-table'
import { RequirementPipelineDialog } from './RequirementPipelineDialog'
import { formatDate, getStatusBadgeClass, generateFGId, downloadCSV, cn, openSignedFile } from '@/lib/utils'

interface Client { id: string; client_name: string }
interface Requirement {
  id: string
  fg_id: string
  client_id: string | null
  requirement_title: string
  category: string | null
  mandatory_skills: string[]
  secondary_skills: string[]
  experience_min: number | null
  experience_max: number | null
  location: string | null
  openings: number
  priority: string
  status: string
  jd_url: string | null
  notes: string | null
  created_at: string
  clients?: { client_name: string } | null
}

const emptyForm = {
  fg_id: '', client_id: '', requirement_title: '', category: '',
  mandatory_skills: '', secondary_skills: '',
  experience_min: '', experience_max: '',
  location: '', openings: '1', priority: 'medium', status: 'open', notes: '',
}

export function RequirementsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<Requirement[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Requirement | null>(null)
  const [pipelineReq, setPipelineReq] = useState<Requirement | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [jdFile, setJdFile] = useState<File | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: reqs }, { data: cls }] = await Promise.all([
      supabase.from('requirements').select('*, clients(client_name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, client_name').eq('status', 'active'),
    ])
    setItems(reqs ?? [])
    setClients(cls ?? [])
    setLoading(false)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, fg_id: generateFGId() })
    setJdFile(null)
    setOpen(true)
  }

  const openEdit = (r: Requirement) => {
    setEditing(r)
    setForm({
      fg_id: r.fg_id, client_id: r.client_id ?? '',
      requirement_title: r.requirement_title, category: r.category ?? '',
      mandatory_skills: r.mandatory_skills.join(', '),
      secondary_skills: r.secondary_skills.join(', '),
      experience_min: r.experience_min?.toString() ?? '',
      experience_max: r.experience_max?.toString() ?? '',
      location: r.location ?? '', openings: r.openings.toString(),
      priority: r.priority, status: r.status, notes: r.notes ?? '',
    })
    setJdFile(null)
    setOpen(true)
  }

  const handleSave = async () => {
    if (!form.requirement_title.trim()) {
      toast({ title: 'Requirement title is required', variant: 'destructive' }); return
    }
    setSaving(true)
    try {
      let jd_url = editing?.jd_url ?? null
      if (jdFile) {
        const path = `${editing?.id ?? 'new'}/${Date.now()}_${jdFile.name}`
        const { error } = await supabase.storage.from('jd-files').upload(path, jdFile, { upsert: true })
        // Bucket is private — store the storage path; a fresh signed URL is
        // generated on demand whenever the JD is opened (see openSignedFile).
        if (!error) jd_url = path
      }

      const payload = {
        fg_id: form.fg_id,
        client_id: form.client_id || null,
        requirement_title: form.requirement_title,
        category: form.category || null,
        mandatory_skills: form.mandatory_skills.split(',').map(s => s.trim()).filter(Boolean),
        secondary_skills: form.secondary_skills.split(',').map(s => s.trim()).filter(Boolean),
        experience_min: form.experience_min ? Number(form.experience_min) : null,
        experience_max: form.experience_max ? Number(form.experience_max) : null,
        location: form.location || null,
        openings: Number(form.openings) || 1,
        priority: form.priority,
        status: form.status,
        notes: form.notes || null,
        jd_url,
      }

      if (editing) {
        await supabase.from('requirements').update(payload).eq('id', editing.id)
        await logActivity({ module: 'Requirements', action: 'Updated requirement', details: form.requirement_title, recordId: editing.id })
        toast({ title: 'Requirement updated', variant: 'success' })
      } else {
        await supabase.from('requirements').insert({ ...payload, created_by: user!.id })
        await logActivity({ module: 'Requirements', action: 'Created requirement', details: form.requirement_title })
        toast({ title: 'Requirement created', variant: 'success' })
      }
      setOpen(false)
      fetchAll()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (r: Requirement) => {
    if (!confirm(`Delete requirement "${r.requirement_title}"?`)) return
    await supabase.from('requirements').delete().eq('id', r.id)
    await logActivity({ module: 'Requirements', action: 'Deleted requirement', details: r.requirement_title })
    toast({ title: 'Requirement deleted', variant: 'success' })
    fetchAll()
  }

  const filtered = filterStatus === 'all' ? items : items.filter(r => r.status === filterStatus)

  const columns: ColumnDef<Requirement>[] = [
    {
      accessorKey: 'fg_id', header: 'FG ID',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setPipelineReq(row.original)}
          className="mono text-xs font-semibold text-primary hover:underline"
          title="View pipeline for this requirement"
        >
          {row.original.fg_id}
        </button>
      ),
    },
    {
      accessorKey: 'requirement_title', header: 'Position',
      cell: ({ row }) => <span className="font-medium">{row.original.requirement_title}</span>,
    },
    {
      accessorKey: 'clients', header: 'Client',
      cell: ({ row }) => row.original.clients?.client_name ?? '—',
    },
    {
      accessorKey: 'location', header: 'Location',
      cell: ({ row }) => row.original.location ?? '—',
    },
    {
      accessorKey: 'openings', header: 'Openings',
      cell: ({ row }) => <span className="font-semibold">{row.original.openings}</span>,
    },
    {
      accessorKey: 'priority', header: 'Priority',
      cell: ({ row }) => (
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize", getStatusBadgeClass(row.original.priority))}>
          {row.original.priority}
        </span>
      ),
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
      accessorKey: 'mandatory_skills', header: 'Key Skills',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1 max-w-48">
          {row.original.mandatory_skills.slice(0, 3).map(s => (
            <span key={s} className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">{s}</span>
          ))}
          {row.original.mandatory_skills.length > 3 && (
            <span className="text-xs text-muted-foreground">+{row.original.mandatory_skills.length - 3}</span>
          )}
        </div>
      ),
    },
    { accessorKey: 'created_at', header: 'Created', cell: ({ row }) => formatDate(row.original.created_at) },
    {
      id: 'actions', header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.jd_url && (
            <Button
              variant="ghost" size="icon" className="h-7 w-7" title="View JD" aria-label="View JD"
              onClick={async () => {
                const { error } = await openSignedFile('jd-files', row.original.jd_url!)
                if (error) toast({ title: 'Could not open JD', variant: 'destructive' })
              }}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(row.original)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(row.original)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Requirements</h1>
          <p className="text-sm text-muted-foreground">{items.length} total requirements</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="hold">Hold</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="filled">Filled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => downloadCSV(items as any[], 'requirements')}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Requirement
          </Button>
        </div>
      </div>

      <DataTable data={filtered} columns={columns} searchPlaceholder="Search requirements…" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Requirement' : 'Create Requirement'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>FG ID *</Label>
                <Input value={form.fg_id} onChange={e => setForm(f => ({ ...f, fg_id: e.target.value }))} className="mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Position / Requirement Title *</Label>
              <Input value={form.requirement_title} onChange={e => setForm(f => ({ ...f, requirement_title: e.target.value }))} placeholder="e.g. Senior Java Developer" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="IT, Finance…" />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Mumbai, Bangalore…" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Mandatory Skills (comma separated)</Label>
              <Input value={form.mandatory_skills} onChange={e => setForm(f => ({ ...f, mandatory_skills: e.target.value }))} placeholder="Java, Spring Boot, Microservices" />
            </div>

            <div className="space-y-1.5">
              <Label>Secondary Skills (comma separated)</Label>
              <Input value={form.secondary_skills} onChange={e => setForm(f => ({ ...f, secondary_skills: e.target.value }))} placeholder="Docker, Kubernetes" />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>Exp Min (yrs)</Label>
                <Input type="number" value={form.experience_min} onChange={e => setForm(f => ({ ...f, experience_min: e.target.value }))} min="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Exp Max (yrs)</Label>
                <Input type="number" value={form.experience_max} onChange={e => setForm(f => ({ ...f, experience_max: e.target.value }))} min="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Openings</Label>
                <Input type="number" value={form.openings} onChange={e => setForm(f => ({ ...f, openings: e.target.value }))} min="1" />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="hold">Hold</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="filled">Filled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>JD Attachment (PDF/DOCX)</Label>
              <Input type="file" accept=".pdf,.docx,.doc" onChange={e => setJdFile(e.target.files?.[0] ?? null)} />
              {editing?.jd_url && !jdFile && (
                <p className="text-xs text-muted-foreground">
                  Current JD:{' '}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={async () => {
                      const { error } = await openSignedFile('jd-files', editing.jd_url!)
                      if (error) toast({ title: 'Could not open JD', variant: 'destructive' })
                    }}
                  >
                    View
                  </button>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RequirementPipelineDialog
        requirementId={pipelineReq?.id ?? null}
        fgId={pipelineReq?.fg_id}
        requirementTitle={pipelineReq?.requirement_title}
        open={!!pipelineReq}
        onOpenChange={(open) => { if (!open) setPipelineReq(null) }}
      />
    </div>
  )
}
