import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '@/types'
import { useLoginSessionTracking } from './useLoginSessionTracking'
import { logActivity } from '@/lib/activityLogger'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  isApproved: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // FEATURE 3/4: creates/resumes a user_login_sessions row, heartbeats it,
  // and best-effort closes it on logout/browser-close. See
  // useLoginSessionTracking.ts for the full lifecycle.
  useLoginSessionTracking(user?.id ?? null)

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) {
      // Fire-and-forget: logActivity looks up the caller's own profile via
      // auth.getUser(), so this is safe to call right after sign-in even
      // before local React state has caught up.
      logActivity({ module: 'Auth', action: 'Logged in', activityType: 'login' })
    }
    return { error }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    // The handle_new_user() DB trigger (supabase/migrations/001_complete_schema.sql)
    // automatically creates the profiles row whenever a new auth.users row is
    // inserted, reading full_name/role from raw_user_meta_data. Previously this
    // function ALSO manually inserted a profiles row with the same id, which
    // always violated the primary key constraint (the trigger had already run)
    // and surfaced a confusing DB error to every single user who signed up,
    // even though their account was actually created successfully. Passing
    // full_name through options.data lets the trigger pick it up instead.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    return { error }
  }

  const signOut = async () => {
    // Must log before signOut() invalidates the session — logActivity
    // attributes the entry via the current session and would silently
    // no-op once there's no user to attribute it to.
    await logActivity({ module: 'Auth', action: 'Logged out', activityType: 'logout' })
    await supabase.auth.signOut()
    setProfile(null)
  }

  const isAdmin = profile?.role === 'admin'
  const isApproved = profile?.status === 'approved'

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading, isAdmin, isApproved,
      signIn, signUp, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
