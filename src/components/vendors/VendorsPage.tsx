import React, { useEffect, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, Trash2, Download } from 'lucide-react'
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
import { formatDate, getStatusBadgeClass, downloadCSV, cn } from '@/lib/utils'

interface Vendor {
  id: string
  vendor_name: string
  contact_person: string | null
  email: string | null
  mobile: string | null
  location: string | null
  gst_number: string | null
  status: 'active' | 'inactive'
  notes: string | null
  created_at: string
}

const emptyForm = {
  vendor_name: '', contact_person: '', email: '', mobile: '',
  location: '', gst_number: '', status: 'active' as 'active' | 'inactive', notes: '',
}

export function VendorsPage() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchVendors() }, [])

  const fetchVendors = async () => {
    setLoading(true)
    const { data } = await supabase.from('vendors').select('*').order('created_at', { ascending: false })
    setVendors(data ?? [])
    setLoading(false)
  }

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true) }
  const openEdit = (v: Vendor) => {
    setEditing(v)
    setForm({ vendor_name: v.vendor_name, contact_person: v.contact_person ?? '', email: v.email ?? '', mobile: v.mobile ?? '', location: v.location ?? '', gst_number: v.gst_number ?? '', status: v.status, notes: v.notes ?? '' })
    setOpen(true)
  }

  const handleSave = async () => {
    if (!form.vendor_name.trim()) { toast({ title: 'Vendor name is required', variant: 'destructive' }); return }
    setSaving(true)
    try {
      if (editing) {
        await supabase.from('vendors').update({ ...form }).eq('id', editing.id)
        await logActivity({ module: 'Vendors', action: 'Updated vendor', details: form.vendor_name, recordId: editing.id })
        toast({ title: 'Vendor updated', variant: 'success' })
      } else {
        await supabase.from('vendors').insert({ ...form, created_by: user!.id })
        await logActivity({ module: 'Vendors', action: 'Created vendor', details: form.vendor_name })
        toast({ title: 'Vendor created', variant: 'success' })
      }
      setOpen(false)
      fetchVendors()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (v: Vendor) => {
    if (!confirm(`Delete vendor "${v.vendor_name}"?`)) return
    const { error } = await supabase.from('vendors').delete().eq('id', v.id)
    if (error) {
      // Business Head can manage vendors but delete stays admin-only as an
      // extra safety margin on a destructive action — this is the
      // expected, correct rejection for that role, not a bug, but it must
      // be surfaced rather than silently shown as a false "deleted" toast.
      toast({ title: 'Could not delete vendor', description: error.message, variant: 'destructive' })
      return
    }
    await logActivity({ module: 'Vendors', action: 'Deleted vendor', details: v.vendor_name })
    toast({ title: 'Vendor deleted', variant: 'success' })
    fetchVendors()
  }

  const columns: ColumnDef<Vendor>[] = [
    { accessorKey: 'vendor_name', header: 'Vendor Name', cell: ({ row }) => <span className="font-medium">{row.original.vendor_name}</span> },
    { accessorKey: 'contact_person', header: 'Contact', cell: ({ row }) => row.original.contact_person ?? '—' },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => row.original.email ?? '—' },
    { accessorKey: 'mobile', header: 'Mobile', cell: ({ row }) => row.original.mobile ?? '—' },
    { accessorKey: 'location', header: 'Location', cell: ({ row }) => row.original.location ?? '—' },
    { accessorKey: 'gst_number', header: 'GST', cell: ({ row }) => row.original.gst_number ? <span className="mono text-xs">{row.original.gst_number}</span> : '—' },
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
          <h1 className="page-title">Vendors</h1>
          <p className="text-sm text-muted-foreground">{vendors.length} vendors</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV(vendors as any[], 'vendors')}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Vendor
          </Button>
        </div>
      </div>

      <DataTable data={vendors} columns={columns} searchPlaceholder="Search vendors…" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Vendor Name *</Label>
              <Input value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} placeholder="e.g. TechStaff Solutions" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact Person</Label>
                <Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile</Label>
                <Input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="City" />
              </div>
              <div className="space-y-1.5">
                <Label>GST Number</Label>
                <Input value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} className="mono" />
              </div>
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
