import React, { useState } from 'react'
import { Settings, User, Bell, Shield, Database, Palette } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/useToast'
import { logActivity } from '@/lib/activityLogger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label, Card, CardContent, CardHeader, CardTitle, CardDescription, Separator, Switch } from '@/components/ui/components'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/forms'

export function SettingsPage() {
  const { profile, refreshProfile } = useAuth()
  const { toast } = useToast()

  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
  })
  const [pwForm, setPwForm] = useState({ password: '', confirm: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState({
    new_requirement: true,
    new_submission: true,
    interview_scheduled: true,
    offer_released: true,
  })

  const handleProfileSave = async () => {
    if (!profileForm.full_name.trim()) {
      toast({ title: 'Full name is required', variant: 'destructive' }); return
    }
    setSavingProfile(true)
    const { error } = await supabase.from('profiles').update({
      full_name: profileForm.full_name,
      phone: profileForm.phone || null,
    }).eq('id', profile!.id)
    if (error) {
      toast({ title: 'Failed to update profile', variant: 'destructive' })
    } else {
      await refreshProfile()
      await logActivity({ module: 'Settings', action: 'Updated profile' })
      toast({ title: 'Profile updated', variant: 'success' })
    }
    setSavingProfile(false)
  }

  const handlePasswordChange = async () => {
    if (pwForm.password.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' }); return
    }
    if (pwForm.password !== pwForm.confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' }); return
    }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.password })
    if (error) {
      toast({ title: 'Failed to update password', variant: 'destructive' })
    } else {
      setPwForm({ password: '', confirm: '' })
      await logActivity({ module: 'Settings', action: 'Changed password' })
      toast({ title: 'Password updated successfully', variant: 'success' })
    }
    setSavingPw(false)
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><User className="h-3.5 w-3.5 mr-1.5" />Profile</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-3.5 w-3.5 mr-1.5" />Security</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-3.5 w-3.5 mr-1.5" />Notifications</TabsTrigger>
          <TabsTrigger value="system"><Database className="h-3.5 w-3.5 mr-1.5" />System</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Profile Information</CardTitle>
              <CardDescription>Update your name and contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
                  {profile?.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{profile?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                  <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 capitalize">{profile?.role}</span>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Full Name *</Label>
                  <Input value={profileForm.full_name} onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={profile?.email ?? ''} disabled className="opacity-60" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Input value={profile?.role ?? ''} disabled className="opacity-60 capitalize" />
                </div>
              </div>

              <Button onClick={handleProfileSave} disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save Profile'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={pwForm.password}
                  onChange={e => setPwForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="At least 6 characters"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Repeat new password"
                />
              </div>
              <Button onClick={handlePasswordChange} disabled={savingPw}>
                {savingPw ? 'Updating…' : 'Update Password'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Notification Preferences</CardTitle>
              <CardDescription>Choose which in-app notifications you receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'new_requirement', label: 'New Requirement Added', desc: 'When a new job requirement is created' },
                { key: 'new_submission', label: 'New Candidate Submitted', desc: 'When a candidate is submitted to a requirement' },
                { key: 'interview_scheduled', label: 'Interview Scheduled', desc: 'When an interview is scheduled' },
                { key: 'offer_released', label: 'Offer Released', desc: 'When an offer is made to a candidate' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={notifPrefs[key as keyof typeof notifPrefs]}
                    onCheckedChange={v => setNotifPrefs(p => ({ ...p, [key]: v }))}
                  />
                </div>
              ))}
              <Button onClick={() => toast({ title: 'Preferences saved', variant: 'success' })}>
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">System Information</CardTitle>
              <CardDescription>Application and environment details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Application', value: 'Talendro ROP v1.0.0' },
                { label: 'Company', value: 'Talendro Solutions' },
                { label: 'Frontend', value: 'React 18 + Vite + TypeScript' },
                { label: 'Backend', value: 'Supabase (PostgreSQL)' },
                { label: 'Deployment', value: 'Vercel' },
                { label: 'Supabase URL', value: import.meta.env.VITE_SUPABASE_URL ? '✓ Configured' : '✗ Not configured' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
