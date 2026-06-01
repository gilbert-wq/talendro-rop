import React, { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Users, UserPlus, UserMinus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { logActivity } from '@/lib/activityLogger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label, Textarea, Card, CardContent, CardHeader, CardTitle, Separator } from '@/components/ui/components'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/forms'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/forms'
import { teamsService, profilesService } from '@/lib/services'
import type { Team, TeamMember, Profile } from '@/types'
import { cn } from '@/lib/utils'

const emptyTeamForm = { team_name: '', manager_id: '', description: '', status: 'active' as 'active' | 'inactive' }

export function TeamsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [teams, setTeams] = useState<Team[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Team | null>(null)
  const [form, setForm] = useState(emptyTeamForm)
  const [saving, setSaving] = useState(false)
  const [addMemberUserId, setAddMemberUserId] = useState('')
  const [addMemberRole, setAddMemberRole] = useState('recruiter')

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (selectedTeam) fetchMembers(selectedTeam.id) }, [selectedTeam])

  const fetchAll = async () => {
    const { data: t } = await teamsService.getAll()
    const { data: p } = await profilesService.getApprovedRecruiters()
    setTeams(t ?? [])
    setProfiles(p ?? [])
  }

  const fetchMembers = async (teamId: string) => {
    const { data } = await teamsService.getMembers(teamId)
    setMembers(data ?? [])
  }

  const handleSave = async () => {
    if (!form.team_name.trim()) { toast({ title: 'Team name required', variant: 'destructive' }); return }
    setSaving(true)
    try {
      if (editing) {
        await teamsService.update(editing.id, { ...form, manager_id: form.manager_id || null })
        toast({ title: 'Team updated', variant: 'success' })
        await logActivity({ module: 'Teams', action: 'Updated team', details: form.team_name })
      } else {
        await teamsService.create({ ...form, manager_id: form.manager_id || null, created_by: user!.id })
        toast({ title: 'Team created', variant: 'success' })
        await logActivity({ module: 'Teams', action: 'Created team', details: form.team_name })
      }
      setOpen(false)
      fetchAll()
    } finally { setSaving(false) }
  }

  const handleDelete = async (t: Team) => {
    if (!confirm(`Delete team "${t.team_name}"?`)) return
    await teamsService.delete(t.id)
    await logActivity({ module: 'Teams', action: 'Deleted team', details: t.team_name })
    toast({ title: 'Team deleted', variant: 'success' })
    if (selectedTeam?.id === t.id) setSelectedTeam(null)
    fetchAll()
  }

  const handleAddMember = async () => {
    if (!selectedTeam || !addMemberUserId) return
    const { error } = await teamsService.addMember(selectedTeam.id, addMemberUserId, addMemberRole)
    if (error) { toast({ title: 'Error adding member', variant: 'destructive' }); return }
    toast({ title: 'Member added', variant: 'success' })
    setAddMemberUserId('')
    fetchMembers(selectedTeam.id)
  }

  const handleRemoveMember = async (teamId: string, userId: string) => {
    await teamsService.removeMember(teamId, userId)
    toast({ title: 'Member removed', variant: 'success' })
    fetchMembers(teamId)
  }

  const nonMembers = profiles.filter(p => !members.some(m => m.user_id === p.id))

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Management</h1>
          <p className="text-sm text-muted-foreground">{teams.length} teams</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setForm(emptyTeamForm); setOpen(true) }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Team
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Teams List */}
        <div className="space-y-2">
          {teams.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">No teams yet</div>
          ) : teams.map(team => (
            <div
              key={team.id}
              onClick={() => setSelectedTeam(team)}
              className={cn(
                "rounded-xl border p-4 cursor-pointer transition-all",
                selectedTeam?.id === team.id ? "border-primary bg-primary/5" : "bg-card hover:border-primary/40"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{team.team_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manager: {(team as any).profiles?.full_name ?? 'Unassigned'}
                  </p>
                  {team.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{team.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => {
                    e.stopPropagation()
                    setEditing(team)
                    setForm({ team_name: team.team_name, manager_id: team.manager_id ?? '', description: team.description ?? '', status: team.status })
                    setOpen(true)
                  }}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={e => { e.stopPropagation(); handleDelete(team) }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className={cn("mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", team.status === 'active' ? 'badge-active' : 'badge-inactive')}>
                {team.status}
              </div>
            </div>
          ))}
        </div>

        {/* Team Members */}
        <div className="lg:col-span-2">
          {!selectedTeam ? (
            <div className="rounded-xl border-2 border-dashed border-border flex items-center justify-center h-64">
              <p className="text-sm text-muted-foreground">Select a team to manage members</p>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {selectedTeam.team_name} — Members ({members.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Member */}
                <div className="flex gap-2">
                  <Select value={addMemberUserId} onValueChange={setAddMemberUserId}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select recruiter to add" /></SelectTrigger>
                    <SelectContent>
                      {nonMembers.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={addMemberRole} onValueChange={setAddMemberRole}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recruiter">Recruiter</SelectItem>
                      <SelectItem value="lead">Team Lead</SelectItem>
                      <SelectItem value="sourcer">Sourcer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAddMember} disabled={!addMemberUserId}>
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add
                  </Button>
                </div>
                <Separator />
                {/* Members list */}
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No members in this team</p>
                ) : (
                  <div className="space-y-2">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg border">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          {(m as any).profiles?.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{(m as any).profiles?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{(m as any).profiles?.email}</p>
                        </div>
                        <span className="text-xs bg-secondary/50 rounded-full px-2 py-0.5 capitalize">{m.role_in_team}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveMember(selectedTeam.id, m.user_id)}>
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Team Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Team' : 'Create Team'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Team Name *</Label>
              <Input value={form.team_name} onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Manager</Label>
              <Select value={form.manager_id} onValueChange={v => setForm(f => ({ ...f, manager_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
