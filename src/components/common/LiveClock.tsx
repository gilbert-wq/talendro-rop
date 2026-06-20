import React, { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

/** FEATURE 5: live clock, updates every second. Visible to admin, recruiter,
 * and vendor alike — it's placed in Header.tsx which renders for every
 * authenticated role, so no extra role-gating is needed here. */
export function LiveClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const datePart = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timePart = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

  return (
    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 text-xs font-medium text-muted-foreground tabular-nums">
      <Clock className="h-3.5 w-3.5 text-primary flex-shrink-0" />
      <span>{datePart}</span>
      <span className="text-border">|</span>
      <span className="text-foreground font-semibold">{timePart}</span>
    </div>
  )
}
