import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { meApi } from './api'
import type { Me } from '../types'

interface AuthState {
  /** false until the stored session has been read — avoids flashing the sign-in screen */
  ready: boolean
  /** true when there is no sign-in (local setup) or a session exists */
  signedIn: boolean
  /** profile from the backend (email, admin flag, server capabilities); null while loading */
  me: Me | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({ ready: false, signedIn: false, me: null, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!supabase)
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const signedIn = !supabase || !!session
  const userId = session?.user.id

  useEffect(() => {
    if (!ready || !signedIn) { setMe(null); return }
    let cancelled = false
    meApi.get().then(m => { if (!cancelled) setMe(m) }).catch(() => {})
    return () => { cancelled = true }
  }, [ready, signedIn, userId])

  const signOut = async () => { await supabase?.auth.signOut() }

  return <AuthContext.Provider value={{ ready, signedIn, me, signOut }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
