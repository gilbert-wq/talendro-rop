import React, { useEffect, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, Trash2, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { logActivity } from '@/lib/activityLogger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label, Textarea, Badge } from '@/components/ui/components'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/forms'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/forms'
import { DataTable } from '@/components/ui/data-table'
import { formatDate, getStatusBadgeClass, downloadCSV, cn } from '@/lib/utils'

interface Client {
  id: string
  client_name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  industry: string | null
  status: 'active' | 'inactive'
  notes: string | null
  created_at: string
}

const emptyForm = {
  client_name: '', contact_person: '', email: '', phone: '',
  industry: '', status: 'active' as 'active' | 'inactive', notes: '',
}

export function ClientsPage() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchClients() }, [])

  const fetchClients = async () => {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data ?? [])
    setLoading(false)
  }

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true) }
  const openEdit = (c: Client) => {
    setEditing(c)
    setForm({ client_name: c.client_name, contact_person: c.contact_person ?? '', email: c.email ?? '', phone: c.phone ?? '', industry: c.industry ?? '', status: c.status, notes: c.notes ?? '' })
    setOpen(true)
  }

  const handleSave = async () => {
    if (!form.client_name.trim()) { toast({ title: 'Client name is required', variant: 'destructive' }); return }
    setSaving(true)
    try {
      if (editing) {
        await supabase.from('clients').update({ ...form }).eq('id', editing.id)
        await logActivity({ module: 'Clients', action: 'Updated client', details: form.client_name, recordId: editing.id })
        toast({ title: 'Client updated', variant: 'success' })
      } else {
        await supabase.from('clients').insert({ ...form, created_by: user!.id })
        await logActivity({ module: 'Clients', action: 'Created client', details: form.client_name })
        toast({ title: 'Client created', variant: 'success' })
      }
      setOpen(false)
      fetchClients()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c: Client) => {
    if (!confirm(`Delete client "${c.client_name}"?`)) return
    const { error } = await supabase.from('clients').delete().eq('id', c.id)
    if (error) {
      toast({ title: 'Could not delete client', description: error.message, variant: 'destructive' })
      return
    }
    await logActivity({ module: 'Clients', action: 'Deleted client', details: c.client_name })
    toast({ title: 'Client deleted', variant: 'success' })
    fetchClients()
  }

  const columns: ColumnDef<Client>[] = [
    { accessorKey: 'client_name', header: 'Client Name', cell: ({ row }) => <span className="font-medium">{row.original.client_name}</span> },
    { accessorKey: 'contact_person', header: 'Contact Person', cell: ({ row }) => row.original.contact_person ?? '—' },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => row.original.email ?? '—' },
    { accessorKey: 'phone', header: 'Phone', cell: ({ row }) => row.original.phone ?? '—' },
    { accessorKey: 'industry', header: 'Industry', cell: ({ row }) => row.original.industry ?? '—' },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => (
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", getStatusBadgeClass(row.original.status))}>
          {row.original.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    { accessorKey: 'created_at', header: 'Created', cell: ({ row }) => formatDate(row.original.created_at) },
    {
      id: 'actions', header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(row.original)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          {isAdmin && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(row.original)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="text-sm text-muted-foreground">{clients.length} clients</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV(clients as any[], 'clients')}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Client
          </Button>
        </div>
      </div>

      <DataTable data={clients} columns={columns} searchPlaceholder="Search clients…" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Client' : 'Add Client'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Client Name *</Label>
              <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="e.g. IBM India" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact Person</Label>
                <Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} placeholder="IT, Banking…" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
    </div>
  )
}
