import React, { useEffect, useState } from 'react'
import {
  Mail, Phone, Building2, Briefcase, Calendar, Cake, MapPin, Users as UsersIcon,
  GraduationCap, Award, Clock, Activity, Star, AlertTriangle, Edit, Loader2,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/forms'
import { Avatar, AvatarFallback, Progress, Separator, Badge, Label } from '@/components/ui/components'
import { Skeleton } from '@/components/ui/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/useToast'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { recruiterInsightsService } from '@/lib/userInsightsService'
import { formatDateTime, formatDate, cn } from '@/lib/utils'
import type { RecruiterProfileSummary, RecruiterPerformance, RecruiterWorkload } from '@/types'

interface RecruiterProfileCardProps {
  userId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground leading-none">{label}</p>
        <p className="text-xs font-medium mt-0.5 break-words">{value ?? '—'}</p>
      </div>
    </div>
  )
}

function MetricCard({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold mt-0.5", accent)}>{value}</p>
    </div>
  )
}

/** FEATURE 1: Recruiter Quick Profile Card. Admin-only (this schema has a
 * single 'admin' role with no separate super-admin tier — see Sidebar/RLS —
 * so "Admin and Super Admin only" from the feature spec maps onto the
 * existing is_admin() check; UsersPage already gates this dialog's trigger
 * to admins). */
export function RecruiterProfileCard({ userId, open, onOpenChange }: RecruiterProfileCardProps) {
  const [summary, setSummary] = useState<RecruiterProfileSummary | null>(null)
  const [performance, setPerformance] = useState<RecruiterPerformance | null>(null)
  const [workload, setWorkload] = useState<RecruiterWorkload | null>(null)
  const [isTopPerformer, setIsTopPerformer] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orgEditOpen, setOrgEditOpen] = useState(false)

  useEffect(() => {
    if (!open || !userId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    // Four independent reads fired in parallel rather than sequentially —
    // this is the "Optimized Queries using Promise.all" requirement.
    Promise.all([
      recruiterInsightsService.getProfileSummary(userId),
      recruiterInsightsService.getPerformance(userId),
      recruiterInsightsService.getWorkload(userId),
      recruiterInsightsService.getLeaderboard(1000),
    ])
      .then(([summaryRes, perfRes, workloadRes, leaderboardRes]) => {
        if (cancelled) return
        if (summaryRes.error) throw summaryRes.error
        if (perfRes.error) throw perfRes.error
        if (workloadRes.error) throw workloadRes.error
        setSummary(summaryRes.data)
        setPerformance(perfRes.data)
        setWorkload(workloadRes.data)
        const entry = leaderboardRes.data?.find(e => e.user_id === userId)
        setIsTopPerformer(!!entry?.is_top_performer)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Could not load recruiter profile')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [open, userId])

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recruiter Profile</DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : loading || !summary ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 flex-shrink-0">
                {summary.avatar_url ? (
                  <img src={summary.avatar_url} alt={summary.full_name} className="h-full w-full object-cover rounded-full" />
                ) : (
                  <AvatarFallback className="text-base">{summary.full_name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold">{summary.full_name}</h3>
                  {isTopPerformer && (
                    <Badge className="bg-amber-500 text-white border-transparent gap-1">
                      <Star className="h-3 w-3 fill-current" /> Top Performer
                    </Badge>
                  )}
                  <Badge variant={summary.status === 'approved' ? 'default' : 'secondary'} className="capitalize">
                    {summary.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {summary.designation || 'Recruiter'} {summary.department ? `· ${summary.department}` : ''}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[11px] text-muted-foreground">Profile Completion</p>
                <p className="text-sm font-bold">{summary.profile_completion_percentage}%</p>
                <Progress value={summary.profile_completion_percentage} className="w-20 mt-1" />
                <Button variant="outline" size="sm" className="mt-2 h-6 text-[11px] px-2" onClick={() => setOrgEditOpen(true)}>
                  <Edit className="h-3 w-3 mr-1" /> Org Info
                </Button>
              </div>
            </div>

            <Separator />

            {/* Personal Information */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Personal Information</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0">
                <InfoRow icon={Award} label="Employee ID" value={summary.employee_id} />
                <InfoRow icon={Mail} label="Email" value={summary.email} />
                <InfoRow icon={Phone} label="Mobile" value={summary.phone} />
                <InfoRow icon={Phone} label="Alternate Mobile" value={summary.alternate_phone} />
                <InfoRow icon={Building2} label="Department" value={summary.department} />
                <InfoRow icon={Briefcase} label="Designation" value={summary.designation} />
                <InfoRow icon={UsersIcon} label="Reporting Manager" value={summary.reporting_manager_name} />
                <InfoRow icon={Calendar} label="Date of Joining" value={summary.date_of_joining ? formatDate(summary.date_of_joining) : null} />
                <InfoRow icon={Cake} label="Date of Birth" value={summary.date_of_birth ? formatDate(summary.date_of_birth) : null} />
                <InfoRow icon={UsersIcon} label="Gender" value={summary.gender ? summary.gender.replace(/_/g, ' ') : null} />
                <InfoRow icon={MapPin} label="Current Address" value={summary.current_address} />
                <InfoRow icon={MapPin} label="Permanent Address" value={summary.permanent_address} />
                <InfoRow icon={Phone} label="Emergency Contact" value={summary.emergency_contact_name ? `${summary.emergency_contact_name} (${summary.emergency_contact_number ?? '—'})` : null} />
                <InfoRow icon={GraduationCap} label="Education" value={summary.education} />
                <InfoRow icon={Briefcase} label="Experience" value={summary.experience_years != null ? `${summary.experience_years} yrs` : null} />
                <InfoRow icon={Clock} label="Last Login" value={summary.last_login_at ? formatDateTime(summary.last_login_at) : 'Never'} />
                <InfoRow icon={Calendar} label="Account Created" value={formatDateTime(summary.created_at)} />
              </div>
            </div>

            <Separator />

            {/* Performance Summary */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Performance Summary</p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                <MetricCard label="Candidates Added" value={performance?.candidates_added ?? 0} />
                <MetricCard label="Candidates Joined" value={performance?.candidates_joined ?? 0} accent="text-emerald-600" />
                <MetricCard label="Submissions" value={performance?.submissions_made ?? 0} />
                <MetricCard label="Interviews Scheduled" value={performance?.interviews_scheduled ?? 0} />
                <MetricCard label="Interviews Cleared" value={performance?.interviews_cleared ?? 0} />
                <MetricCard label="Offers Released" value={performance?.offers_released ?? 0} />
                <MetricCard label="Offers Accepted" value={performance?.offers_accepted ?? 0} accent="text-emerald-600" />
                <MetricCard label="Offer Conversion" value={`${performance?.offer_conversion_rate ?? 0}%`} accent="text-primary" />
                <MetricCard label="Joining Conversion" value={`${performance?.joining_conversion_rate ?? 0}%`} accent="text-primary" />
              </div>
            </div>

            <Separator />

            {/* Current Workload */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Current Workload</p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                <MetricCard label="Active Requirements" value={workload?.active_requirements ?? 0} />
                <MetricCard label="Active Candidates" value={workload?.active_candidates ?? 0} />
                <MetricCard label="Open Interviews" value={workload?.open_interviews ?? 0} />
                <MetricCard label="Pending Offers" value={workload?.pending_offers ?? 0} />
                <MetricCard label="Pending Follow-Ups" value={workload?.pending_followups ?? 0} />
                <MetricCard label="Pending Actions" value={workload?.pending_actions ?? 0} accent="text-amber-600" />
              </div>
            </div>

            <Separator />

            {/* Activity Information */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Activity Information
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                <InfoRow icon={Clock} label="Last Login" value={summary.last_login_at ? formatDateTime(summary.last_login_at) : 'Never'} />
                <InfoRow icon={Activity} label="Account Status" value={<span className="capitalize">{summary.status}</span>} />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {summary && (
      <OrgInfoEditDialog
        open={orgEditOpen}
        onOpenChange={setOrgEditOpen}
        userId={summary.id}
        currentEmployeeId={summary.employee_id}
        currentReportingManager={null}
        onSaved={(employeeId, reportingManagerName) => {
          setSummary(prev => prev ? { ...prev, employee_id: employeeId, reporting_manager_name: reportingManagerName } : prev)
        }}
      />
    )}
    </>
  )
}

/** Leadership-only action: fills in the organizational fields (employee ID,
 * reporting manager) that nothing else in the app ever lets anyone set —
 * recruiters self-report personal/contact info via My Profile, but an
 * employee ID and reporting line are organizational facts assigned by
 * leadership, not something the account holder should set unilaterally.
 * This is what addresses "more columns empty about each recruiter
 * profile" — there was previously no UI anywhere to populate these two
 * fields at all. */
function OrgInfoEditDialog({ open, onOpenChange, userId, currentEmployeeId, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; userId: string
  currentEmployeeId: string | null; currentReportingManager: string | null
  onSaved: (employeeId: string | null, reportingManagerName: string | null) => void
}) {
  const { toast } = useToast()
  const [employeeId, setEmployeeId] = useState('')
  const [managers, setManagers] = useState<{ id: string; full_name: string }[]>([])
  const [managerId, setManagerId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmployeeId(currentEmployeeId ?? '')
    supabase.from('profiles').select('id, full_name').eq('status', 'approved').neq('id', userId)
      .then(({ data }) => setManagers(data ?? []))
    supabase.from('profiles').select('reporting_manager').eq('id', userId).single()
      .then(({ data }) => setManagerId(data?.reporting_manager ?? ''))
  }, [open, userId, currentEmployeeId])

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      employee_id: employeeId.trim() || null,
      reporting_manager: managerId || null,
    }).eq('id', userId)
    setSaving(false)
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' })
      return
    }
    await logActivity({ module: 'Users', action: 'Updated organizational info', recordId: userId, activityType: 'profile_updated' })
    toast({ title: 'Saved', variant: 'success' })
    onSaved(employeeId.trim() || null, managers.find(m => m.id === managerId)?.full_name ?? null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Edit Organizational Info</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Employee ID</Label>
            <Input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="e.g. TAL-0042" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reporting Manager</Label>
            <select
              className="w-full h-9 rounded-lg border bg-background px-3 text-sm"
              value={managerId}
              onChange={e => setManagerId(e.target.value)}
            >
              <option value="">— None —</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
