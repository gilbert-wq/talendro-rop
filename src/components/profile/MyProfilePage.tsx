import React, { useEffect, useState } from 'react'
import { Loader2, Upload, Save, Mail, Shield, Briefcase, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Label, Progress, Separator } from '@/components/ui/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/forms'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { formatDate, formatDateTime } from '@/lib/utils'

interface FormState {
  full_name: string
  phone: string
  alternate_phone: string
  date_of_birth: string
  gender: string
  current_address: string
  permanent_address: string
  emergency_contact_name: string
  emergency_contact_number: string
  education: string
  experience_years: string
  department: string
  designation: string
  date_of_joining: string
}

/** Self-service "My Profile" — every account holder (recruiter, business
 * head, or admin) can view and update their own info here at any time,
 * unlike ProfileCompletionModal which only runs once as a mandatory gate.
 * employee_id and reporting manager are intentionally read-only here —
 * those are organizational facts assigned by leadership/admin (see the
 * "Edit Organizational Info" action on RecruiterProfileCard), not personal
 * preferences the account holder should be able to set unilaterally. */
export function MyProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const { toast } = useToast()
  const [reportingManagerName, setReportingManagerName] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    full_name: '', phone: '', alternate_phone: '', date_of_birth: '', gender: '',
    current_address: '', permanent_address: '', emergency_contact_name: '',
    emergency_contact_number: '', education: '', experience_years: '',
    department: '', designation: '', date_of_joining: '',
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    setForm({
      full_name: profile.full_name ?? '',
      phone: profile.phone ?? '',
      alternate_phone: profile.alternate_phone ?? '',
      date_of_birth: profile.date_of_birth ?? '',
      gender: profile.gender ?? '',
      current_address: profile.current_address ?? '',
      permanent_address: profile.permanent_address ?? '',
      emergency_contact_name: profile.emergency_contact_name ?? '',
      emergency_contact_number: profile.emergency_contact_number ?? '',
      education: profile.education ?? '',
      experience_years: profile.experience_years?.toString() ?? '',
      department: profile.department ?? '',
      designation: profile.designation ?? '',
      date_of_joining: profile.date_of_joining ?? '',
    })
    setPhotoPreview(profile.avatar_url)
    if (profile.reporting_manager) {
      supabase.from('profiles').select('full_name').eq('id', profile.reporting_manager).single()
        .then(({ data }) => setReportingManagerName(data?.full_name ?? null))
    }
  }, [profile])

  if (!profile) return null

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      let avatar_url = profile.avatar_url
      if (photoFile) {
        const path = `${profile.id}/${Date.now()}_${photoFile.name}`
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, photoFile, { upsert: true })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        avatar_url = data.publicUrl
      }

      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        alternate_phone: form.alternate_phone.trim() || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        current_address: form.current_address.trim() || null,
        permanent_address: form.permanent_address.trim() || null,
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_number: form.emergency_contact_number.trim() || null,
        education: form.education.trim() || null,
        experience_years: form.experience_years ? Number(form.experience_years) : null,
        department: form.department.trim() || null,
        designation: form.designation.trim() || null,
        date_of_joining: form.date_of_joining || null,
        avatar_url,
      }).eq('id', profile.id)
      if (error) throw error

      await logActivity({ module: 'Profile', action: 'Updated own profile', activityType: 'profile_updated' })
      toast({ title: 'Profile updated', variant: 'success' })
      await refreshProfile()
      setPhotoFile(null)
    } catch (err: any) {
      toast({ title: 'Could not save profile', description: err?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="text-sm text-muted-foreground">View and update your own information</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 border">
              {photoPreview ? <img src={photoPreview} alt={profile.full_name} className="h-full w-full object-cover" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="flex-1">
              <Label className="text-xs">Profile Photo</Label>
              <Input type="file" accept="image/*" onChange={handlePhotoChange} className="text-xs" />
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Profile Completion</p>
              <p className="text-sm font-bold">{profile.profile_completion_percentage}%</p>
              <Progress value={profile.profile_completion_percentage} className="w-24 mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{profile.email}</div>
            <div className="flex items-center gap-1.5 capitalize"><Shield className="h-3.5 w-3.5" />{profile.role.replace('_', ' ')}</div>
            <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Joined {formatDate(profile.created_at)}</div>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Organizational Info (managed by leadership)</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><p className="text-[11px] text-muted-foreground">Employee ID</p><p className="font-medium">{profile.employee_id ?? '—'}</p></div>
              <div><p className="text-[11px] text-muted-foreground">Reporting Manager</p><p className="font-medium">{reportingManagerName ?? '—'}</p></div>
              <div><p className="text-[11px] text-muted-foreground">Last Login</p><p className="font-medium">{profile.last_login_at ? formatDateTime(profile.last_login_at) : 'Never'}</p></div>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Personal & Work Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Full Name</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Alternate Phone</Label><Input value={form.alternate_phone} onChange={e => setForm(f => ({ ...f, alternate_phone: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.gender || 'unspecified'} onValueChange={v => setForm(f => ({ ...f, gender: v === 'unspecified' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unspecified">Prefer not to say</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Department</Label><Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Designation</Label><Input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Date of Joining</Label><Input type="date" value={form.date_of_joining} onChange={e => setForm(f => ({ ...f, date_of_joining: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Education</Label><Input value={form.education} onChange={e => setForm(f => ({ ...f, education: e.target.value }))} placeholder="B.Tech, MBA…" /></div>
              <div className="space-y-1.5"><Label>Experience (years)</Label><Input type="number" min="0" step="0.5" value={form.experience_years} onChange={e => setForm(f => ({ ...f, experience_years: e.target.value }))} /></div>
              <div className="space-y-1.5 col-span-2"><Label>Current Address</Label><Input value={form.current_address} onChange={e => setForm(f => ({ ...f, current_address: e.target.value }))} /></div>
              <div className="space-y-1.5 col-span-2"><Label>Permanent Address</Label><Input value={form.permanent_address} onChange={e => setForm(f => ({ ...f, permanent_address: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Emergency Contact Name</Label><Input value={form.emergency_contact_name} onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Emergency Contact Number</Label><Input value={form.emergency_contact_number} onChange={e => setForm(f => ({ ...f, emergency_contact_number: e.target.value }))} /></div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
