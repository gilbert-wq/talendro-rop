import { useEffect, useRef } from 'react'
import { UAParser } from 'ua-parser-js'
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase'
import { loginSessionService } from '@/lib/userInsightsService'

const SESSION_KEY = 'talendro_login_session_id'
const HEARTBEAT_INTERVAL_MS = 60_000 // touches updated_at; server treats >15min stale as offline

function detectDevice() {
  const { browser, os, device } = UAParser(navigator.userAgent)
  const deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown' =
    device.type === 'mobile' ? 'mobile' : device.type === 'tablet' ? 'tablet' : device.type ? 'unknown' : 'desktop'
  return {
    device_type: deviceType,
    browser_name: browser.name ? `${browser.name} ${browser.version ?? ''}`.trim() : null,
    operating_system: os.name ? `${os.name} ${os.version ?? ''}`.trim() : null,
  }
}

// Best-effort public IP lookup. This is genuine reported data (not mocked),
// but it is the *client's* reported IP via a third-party service rather
// than a server-verified address — there's no edge function / backend in
// this architecture to read the real request IP from, so this is the
// honest, commonly-used approach for a pure SPA + Supabase stack. Failure
// (network restrictions, ad-blockers, offline) degrades gracefully to null
// rather than fabricating a value.
async function fetchPublicIP(): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    return data.ip ?? null
  } catch {
    return null
  }
}

/** Best-effort synchronous-ish logout call that survives a tab being closed.
 * Regular supabase-js calls can be cancelled mid-flight when the page
 * unloads; `keepalive: true` tells the browser to let this specific
 * request finish in the background even after navigation/unload starts. */
async function sendKeepaliveLogout(sessionId: string) {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    const url = `${supabaseUrl}/rest/v1/user_login_sessions?id=eq.${sessionId}`
    await fetch(url, {
      method: 'PATCH',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ logout_time: new Date().toISOString() }),
    })
  } catch {
    // If this fails (offline, blocked, etc.) the 15-minute heartbeat
    // staleness reconciliation in get_online_users()/the attendance RPC
    // is the fallback that eventually closes the session out anyway.
  }
}

/**
 * Tracks login sessions for FEATURE 3/4 (login session tracking + live
 * online users). One row is created per browser tab's first activity since
 * sign-in (resumed across refreshes via sessionStorage, which is scoped to
 * the tab and cleared on close) rather than per page load, so refreshing
 * the page doesn't spam new session rows while still giving each open tab
 * its own presence row for online tracking.
 */
export function useLoginSessionTracking(userId: string | null) {
  const sessionIdRef = useRef<string | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!userId) {
      // Signed out — close out whatever session this tab was tracking.
      const existing = sessionStorage.getItem(SESSION_KEY)
      if (existing) {
        loginSessionService.logout(existing).then(undefined, () => {})
        sessionStorage.removeItem(SESSION_KEY)
      }
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      sessionIdRef.current = null
      return
    }

    let cancelled = false

    const ensureSession = async () => {
      const existing = sessionStorage.getItem(SESSION_KEY)
      if (existing) {
        // Resume: try a heartbeat. If the row was already marked inactive
        // by the server-side staleness sweep (long-suspended tab), this
        // update simply matches zero rows — harmless — and we fall through
        // to creating a fresh session below.
        const { error } = await loginSessionService.heartbeat(existing)
        if (!error) {
          sessionIdRef.current = existing
          return
        }
      }

      const { device_type, browser_name, operating_system } = detectDevice()
      const ip_address = await fetchPublicIP()
      if (cancelled) return

      const { data, error } = await loginSessionService.create({
        user_id: userId,
        login_time: new Date().toISOString(),
        ip_address,
        device_type,
        browser_name,
        operating_system,
        location: null, // requires a GeoIP provider + API key that isn't configured; left honest rather than mocked
      })
      if (!error && data) {
        sessionIdRef.current = data.id
        sessionStorage.setItem(SESSION_KEY, data.id)
      }
    }

    ensureSession()

    heartbeatRef.current = setInterval(() => {
      if (sessionIdRef.current) loginSessionService.heartbeat(sessionIdRef.current).then(undefined, () => {})
    }, HEARTBEAT_INTERVAL_MS)

    const handleUnload = () => {
      if (sessionIdRef.current) sendKeepaliveLogout(sessionIdRef.current)
    }
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)

    return () => {
      cancelled = true
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
    }
  }, [userId])
}
