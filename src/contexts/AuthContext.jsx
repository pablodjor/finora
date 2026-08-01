import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ROLES } from '../lib/constants'
import * as authService from '../services/auth'
import * as profileService from '../services/profiles'
import { useTheme } from './ThemeContext'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const { setTheme } = useTheme()

  async function loadProfile(userId) {
    const data = await profileService.getProfile(userId)
    setProfile(data)
    if (data?.theme) setTheme(data.theme)
    return data
  }

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const current = await authService.getSession()
        if (!mounted) return
        setSession(current)
        setUser(current?.user ?? null)
        if (current?.user) {
          await loadProfile(current.user.id)
        }
      } catch (error) {
        console.error(error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (nextSession?.user) {
        try {
          await loadProfile(nextSession.user.id)
        } catch (error) {
          console.error(error)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      isAuthenticated: Boolean(session?.user),
      isAdmin: profile?.role === ROLES.ADMIN,
      isActive: profile?.is_active !== false,
      signIn: authService.signIn,
      signUp: authService.signUp,
      signOut: authService.signOut,
      resetPassword: authService.resetPassword,
      refreshProfile: async () => {
        if (!user) return null
        return loadProfile(user.id)
      },
      updateProfile: async (updates) => {
        if (!user) return null
        const updated = await profileService.updateProfile(user.id, updates)
        setProfile(updated)
        if (updated?.theme) setTheme(updated.theme)
        return updated
      },
    }),
    [session, user, profile, loading, setTheme],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
