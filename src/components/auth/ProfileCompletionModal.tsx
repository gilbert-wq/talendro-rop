import React, { useState } from 'react'
import { Loader2, Upload, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/forms'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label, Progress } from '@/components/ui/components'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'

interface FormState {
  full_name: string
  phone: string
  date_of_joining: string
  department: string
  designation: string
  emergency_contact_name: string
  emergency_contact_number: string
  current_address: string
}

/** FEATURE 2: mandatory profile completion enforcement. Rendered by
 * RequireAuth in App.tsx in place of the app shell whenever
 * profile.profile_completed === false — close is blocked at every layer:
 * no close button (hideCloseButton), Escape and outside-click are
 * intercepted with preventDefault, and the parent only ever renders this
 * dialog (not the routed app), so there is no navigation to fall back to
 * until the server-computed profile_completion_percentage trigger marks
 * the profile complete. */
export function ProfileCompletionModal() {
  const { profile, refreshProfile } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = useState<FormState>({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    date_of_joining: profile?.date_of_joining ?? '',
    department: profile?.department ?? '',
    designation: profile?.designation ?? '',
    emergency_contact_name: profile?.emergency_contact_name ?? '',
    emergency_contact_number: profile?.emergency_contact_number ?? '',
    current_address: profile?.current_address ?? '',
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile?.avatar_url ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!profile) return null

  // Live, client-side preview of the same 8-item / 12.5%-each formula the
  // DB trigger (calculate_profile_completion) computes authoritatively on
  // save — this is purely a UI affordance; the server value is what
  // actually flips profile_completed, never this local estimate.
  const liveScore = [
    form.full_name.trim(), form.phone.trim(), form.date_of_joining,
    form.department.trim(), form.designation.trim(),
    form.emergency_contact_name.trim() && form.emergency_contact_number.trim(),
    form.current_address.trim(),
    photoFile || photoPreview,
  ].filter(Boolean).length
  const livePercent = Math.round((liveScore / 8) * 100)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim() || !form.phone.trim() || !form.date_of_joining || !form.department.trim()
      || !form.designation.trim() || !form.emergency_contact_name.trim() || !form.emergency_contact_number.trim()
      || !form.current_address.trim() || (!photoFile && !photoPreview)) {
      setError('All fields, including a profile photo, are required to continue.')
      return
    }
    setSaving(true)
    setError('')
    try {
      let avatar_url = profile.avatar_url
      if (photoFile) {
        // company-assets is the one PUBLIC bucket (branding/avatars are not
        // sensitive PII the way resumes/ID documents are), so a plain
        // public URL is appropriate here, unlike the candidate document
        // buckets which use signed URLs.
        const path = `avatars/${profile.id}/${Date.now()}_${photoFile.name}`
        const { error: uploadError } = await supabase.storage.from('company-assets').upload(path, photoFile, { upsert: true })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('company-assets').getPublicUrl(path)
        avatar_url = data.publicUrl
      }

      const { error: updateError } = await supabase.from('profiles').update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        date_of_joining: form.date_of_joining,
        department: form.department.trim(),
        designation: form.designation.trim(),
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact_number: form.emergency_contact_number.trim(),
        current_address: form.current_address.trim(),
        avatar_url,
      }).eq('id', profile.id)
      if (updateError) throw updateError

      await logActivity({ module: 'Profile', action: 'Completed profile', activityType: 'profile_updated' })
      toast({ title: 'Profile completed', description: 'Welcome aboard!', variant: 'success' })
      await refreshProfile()
    } catch (err: any) {
      setError(err?.message ?? 'Could not save your profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => { /* non-dismissible: intentionally a no-op */ }}>
      <DialogContent
        hideCloseButton
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Complete your profile to continue</DialogTitle>
          <DialogDescription>
            Talendro ROP requires a few details before you can access the dashboard. This only takes a minute.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 -mt-2 mb-1">
          <Progress value={livePercent} className="flex-1" />
          <span className="text-xs font-semibold text-muted-foreground tabular-nums w-10 text-right">{livePercent}%</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">{error}</div>
          )}

          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 border">
              {photoPreview ? <img src={photoPreview} alt="Profile" className="h-full w-full object-cover" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="flex-1">
              <Label className="text-xs">Profile Photo *</Label>
              <Input type="file" accept="image/*" onChange={handlePhotoChange} className="text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Full Name *</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone *</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date of Joining *</Label>
              <Input type="date" value={form.date_of_joining} onChange={e => setForm(f => ({ ...f, date_of_joining: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Department *</Label>
              <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. Recruitment" required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Designation *</Label>
              <Input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g. Senior Recruiter" required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Emergency Contact Name *</Label>
              <Input value={form.emergency_contact_name} onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Emergency Contact Number *</Label>
              <Input value={form.emergency_contact_number} onChange={e => setForm(f => ({ ...f, emergency_contact_number: e.target.value }))} required />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Current Address *</Label>
              <Input value={form.current_address} onChange={e => setForm(f => ({ ...f, current_address: e.target.value }))} required />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            {saving ? 'Saving…' : 'Complete Profile & Continue'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
