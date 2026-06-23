import React, { useState } from 'react'
import { Building2, ExternalLink, FileText, Settings } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/components'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { SOPViewerDialog } from './SOPViewerDialog'
import { SOPManagerDialog } from './SOPManagerDialog'

/** FEATURE 5/6: company details widget for the dashboard, plus the entry
 * points into the SOP viewer (everyone) and SOP manager (admin only).
 * Copy below is sourced from talendrosolutions.com's own meta description
 * (paraphrased), not invented — the site is a JS-rendered single page with
 * no further crawlable detail beyond its tagline, so this intentionally
 * doesn't claim specifics (founding year, team size, service list) that
 * aren't actually published there. */
export function CompanyInfoCard() {
  const { isAdmin } = useAuth()
  const [viewerOpen, setViewerOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-primary" /> Talendro Solutions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Talendro Solutions provides IT recruitment and HR consulting — smart,
          end-to-end hiring for technology roles paired with practical, compliant
          HR frameworks for startups and growing enterprises.
        </p>
        <a
          href="https://talendrosolutions.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1 w-fit"
        >
          talendrosolutions.com <ExternalLink className="h-3 w-3" />
        </a>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => setViewerOpen(true)} className="flex-1">
            <FileText className="h-3.5 w-3.5 mr-1.5" /> View SOPs
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setManagerOpen(true)} className="flex-1">
              <Settings className="h-3.5 w-3.5 mr-1.5" /> Manage SOPs
            </Button>
          )}
        </div>
      </CardContent>

      <SOPViewerDialog open={viewerOpen} onOpenChange={setViewerOpen} />
      {isAdmin && <SOPManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />}
    </Card>
  )
}
