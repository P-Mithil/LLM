import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import { apiFetch, setStoredToken } from '../lib/api'

export type Profile = {
  id: string
  name: string
  email: string
  role: 'student' | 'faculty'
}

type AuthState = {
  loading: boolean
  profile: Profile | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)

  async function refreshProfile() {
    const me = await apiFetch<Profile>('/me')
    setProfile(me)
  }

  async function signOut() {
    setStoredToken(null)
    setProfile(null)
  }

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        await refreshProfile()
      } catch {
        if (mounted) setProfile(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({ loading, profile, refreshProfile, signOut }),
    [loading, profile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

