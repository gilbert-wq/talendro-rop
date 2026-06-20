import React, { useEffect, useState } from 'react'
import { Trophy, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/components'
import { Skeleton } from '@/components/ui/components'
import { recruiterInsightsService } from '@/lib/userInsightsService'
import { cn } from '@/lib/utils'
import type { LeaderboardEntry } from '@/types'

const rankStyles: Record<number, string> = {
  1: 'text-amber-500',
  2: 'text-slate-400',
  3: 'text-orange-600',
}

/** FEATURE 8: top recruiters leaderboard. Visible to any approved user
 * (admin or recruiter) — get_recruiter_leaderboard() doesn't gate this to
 * admin-only since a competitive leaderboard is normally org-wide visible
 * by design, and Feature 11 doesn't list it under the explicit admin-only
 * surfaces (attendance/sessions/activity-logs). */
export function RecruiterLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    recruiterInsightsService.getLeaderboard(10).then(({ data, error }) => {
      if (error) setError(error.message)
      else setEntries(data ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-amber-500" /> Top Recruiters
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No recruiter activity yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-muted-foreground uppercase tracking-wide border-b">
                  <th className="text-left pb-1.5 pr-2">#</th>
                  <th className="text-left pb-1.5">Recruiter</th>
                  <th className="text-right pb-1.5 px-1.5">Cand.</th>
                  <th className="text-right pb-1.5 px-1.5">Subm.</th>
                  <th className="text-right pb-1.5 px-1.5">Int.</th>
                  <th className="text-right pb-1.5 px-1.5">Offers</th>
                  <th className="text-right pb-1.5 px-1.5">Joins</th>
                  <th className="text-right pb-1.5 pl-1.5">Score</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.user_id} className="border-b last:border-0">
                    <td className={cn("py-1.5 pr-2 font-bold", rankStyles[e.rank])}>{e.rank}</td>
                    <td className="py-1.5 font-medium">
                      <span className="flex items-center gap-1">
                        {e.full_name}
                        {e.is_top_performer && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
                      </span>
                    </td>
                    <td className="text-right py-1.5 px-1.5 tabular-nums">{e.candidates_added}</td>
                    <td className="text-right py-1.5 px-1.5 tabular-nums">{e.submissions_made}</td>
                    <td className="text-right py-1.5 px-1.5 tabular-nums">{e.interviews_cleared}</td>
                    <td className="text-right py-1.5 px-1.5 tabular-nums">{e.offers_accepted}</td>
                    <td className="text-right py-1.5 px-1.5 tabular-nums">{e.joins}</td>
                    <td className="text-right py-1.5 pl-1.5 font-bold tabular-nums">{e.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
