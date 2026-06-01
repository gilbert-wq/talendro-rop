import { useQuery } from '@tanstack/react-query'
import {
  clientsService, vendorsService, requirementsService, candidatesService,
  submissionsService, interviewsService, offersService, teamsService,
  targetsService, activityLogsService, notificationsService, dashboardService,
  profilesService,
} from '@/lib/services'
import { useAuth } from './useAuth'

export const QUERY_KEYS = {
  dashboard: ['dashboard'] as const,
  recruiterKPIs: ['recruiter-kpis'] as const,
  clients: ['clients'] as const,
  clientsActive: ['clients', 'active'] as const,
  vendors: ['vendors'] as const,
  requirements: ['requirements'] as const,
  requirementsOpen: ['requirements', 'open'] as const,
  candidates: ['candidates'] as const,
  submissions: ['submissions'] as const,
  interviews: ['interviews'] as const,
  offers: ['offers'] as const,
  teams: ['teams'] as const,
  targets: ['targets'] as const,
  activityLogs: ['activity-logs'] as const,
  notifications: (uid: string) => ['notifications', uid] as const,
  profiles: ['profiles'] as const,
  myTargets: (uid: string) => ['targets', uid] as const,
}

export function useDashboardStats() {
  return useQuery({ queryKey: QUERY_KEYS.dashboard, queryFn: dashboardService.getStats })
}

export function useRecruiterKPIs(since?: string) {
  return useQuery({ queryKey: [...QUERY_KEYS.recruiterKPIs, since], queryFn: () => dashboardService.getRecruiterKPIs(since) })
}

export function useSubmissionsByMonth() {
  return useQuery({ queryKey: ['submissions-by-month'], queryFn: dashboardService.getSubmissionsByMonth })
}

export function useClients() {
  return useQuery({ queryKey: QUERY_KEYS.clients, queryFn: async () => { const { data, error } = await clientsService.getAll(); if (error) throw error; return data ?? [] } })
}

export function useActiveClients() {
  return useQuery({ queryKey: QUERY_KEYS.clientsActive, queryFn: async () => { const { data, error } = await clientsService.getActive(); if (error) throw error; return data ?? [] } })
}

export function useVendors() {
  return useQuery({ queryKey: QUERY_KEYS.vendors, queryFn: async () => { const { data, error } = await vendorsService.getAll(); if (error) throw error; return data ?? [] } })
}

export function useRequirements() {
  return useQuery({ queryKey: QUERY_KEYS.requirements, queryFn: async () => { const { data, error } = await requirementsService.getAll(); if (error) throw error; return data ?? [] } })
}

export function useOpenRequirements() {
  return useQuery({ queryKey: QUERY_KEYS.requirementsOpen, queryFn: async () => { const { data, error } = await requirementsService.getOpen(); if (error) throw error; return data ?? [] } })
}

export function useCandidates() {
  return useQuery({ queryKey: QUERY_KEYS.candidates, queryFn: async () => { const { data, error } = await candidatesService.getAll(); if (error) throw error; return data ?? [] } })
}

export function useSubmissions() {
  return useQuery({ queryKey: QUERY_KEYS.submissions, queryFn: async () => { const { data, error } = await submissionsService.getAll(); if (error) throw error; return data ?? [] } })
}

export function useInterviews() {
  return useQuery({ queryKey: QUERY_KEYS.interviews, queryFn: async () => { const { data, error } = await interviewsService.getAll(); if (error) throw error; return data ?? [] } })
}

export function useOffers() {
  return useQuery({ queryKey: QUERY_KEYS.offers, queryFn: async () => { const { data, error } = await offersService.getAll(); if (error) throw error; return data ?? [] } })
}

export function useTeams() {
  return useQuery({ queryKey: QUERY_KEYS.teams, queryFn: async () => { const { data, error } = await teamsService.getAll(); if (error) throw error; return data ?? [] } })
}

export function useTargets() {
  return useQuery({ queryKey: QUERY_KEYS.targets, queryFn: async () => { const { data, error } = await targetsService.getAll(); if (error) throw error; return data ?? [] } })
}

export function useMyTargets() {
  const { user } = useAuth()
  return useQuery({ queryKey: QUERY_KEYS.myTargets(user?.id ?? ''), queryFn: async () => { if (!user) return []; const { data, error } = await targetsService.getByUser(user.id); if (error) throw error; return data ?? [] }, enabled: !!user })
}

export function useActivityLogs() {
  return useQuery({ queryKey: QUERY_KEYS.activityLogs, queryFn: async () => { const { data, error } = await activityLogsService.getAll(); if (error) throw error; return data ?? [] } })
}

export function useProfiles() {
  return useQuery({ queryKey: QUERY_KEYS.profiles, queryFn: async () => { const { data, error } = await profilesService.getAll(); if (error) throw error; return data ?? [] } })
}

export function useApprovedRecruiters() {
  return useQuery({ queryKey: [...QUERY_KEYS.profiles, 'approved'], queryFn: async () => { const { data, error } = await profilesService.getApprovedRecruiters(); if (error) throw error; return data ?? [] } })
}

export function useNotifications() {
  const { user } = useAuth()
  return useQuery({ queryKey: QUERY_KEYS.notifications(user?.id ?? ''), queryFn: async () => { if (!user) return []; const { data, error } = await notificationsService.getByUser(user.id); if (error) throw error; return data ?? [] }, enabled: !!user, refetchInterval: 30000 })
}
