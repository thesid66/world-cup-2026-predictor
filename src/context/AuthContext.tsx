import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type SignUpInput = {
  email: string
  password: string
  displayName?: string
}

type SignInInput = {
  email: string
  password: string
}

type EmailInput = {
  email: string
}

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  isConfigured: boolean
  signInWithPassword: (input: SignInInput) => Promise<void>
  signUpWithPassword: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>
  resendEmailConfirmation: (input: EmailInput) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthProviderProps = {
  children: ReactNode
}

function normaliseEmail(email: string) {
  return email.trim().toLowerCase()
}

function getAuthRedirectUrl() {
  const configuredRedirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined

  if (configuredRedirectUrl?.trim()) {
    return configuredRedirectUrl.trim()
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return undefined
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return

      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signInWithPassword({ email, password }: SignInInput) {
    if (!supabase) {
      throw new Error('Supabase is not configured.')
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normaliseEmail(email),
      password
    })

    if (error) {
      throw error
    }
  }

  async function signUpWithPassword({ email, password, displayName }: SignUpInput) {
    if (!supabase) {
      throw new Error('Supabase is not configured.')
    }

    const { data, error } = await supabase.auth.signUp({
      email: normaliseEmail(email),
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
        data: {
          display_name: displayName?.trim() ?? ''
        }
      }
    })

    if (error) {
      throw error
    }

    return {
      needsEmailConfirmation: !data.session
    }
  }

  async function resendEmailConfirmation({ email }: EmailInput) {
    if (!supabase) {
      throw new Error('Supabase is not configured.')
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normaliseEmail(email),
      options: {
        emailRedirectTo: getAuthRedirectUrl()
      }
    })

    if (error) {
      throw error
    }
  }

  async function signOut() {
    if (!supabase) return

    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      isConfigured: isSupabaseConfigured,
      signInWithPassword,
      signUpWithPassword,
      resendEmailConfirmation,
      signOut
    }),
    [loading, session]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
