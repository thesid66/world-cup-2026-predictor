import { useState, type FormEvent } from 'react'
import { Lock, Mail, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

type AuthMode = 'sign-in' | 'sign-up'

export function AuthModal() {
  const { user, loading, isConfigured, signInWithPassword, signUpWithPassword } = useAuth()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (loading || user || !isConfigured) {
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      if (mode === 'sign-in') {
        await signInWithPassword({ email, password })
        setMessage('Signed in. Loading your predictions...')
      } else {
        const result = await signUpWithPassword({ email, password, displayName })

        if (result.needsEmailConfirmation) {
          setMessage('Account created. Check your email to confirm your account, then sign in.')
          setMode('sign-in')
        } else {
          setMessage('Account created. Loading your predictions...')
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Authentication failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 px-4 py-8 backdrop-blur-xl">
      <div className="w-full max-w-lg overflow-hidden rounded-4xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/50 ring-1 ring-white/10">
        <div className="bg-linear-to-br from-yellow-300/15 via-sky-400/10 to-emerald-300/15 p-6">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-yellow-200">
            Cloud predictions
          </p>

          <h2 className="mt-3 text-3xl font-black text-white">
            {mode === 'sign-in' ? 'Sign in to continue' : 'Create your predictor account'}
          </h2>

          <p className="mt-3 text-sm leading-6 text-slate-300">
            Your existing browser predictions will be copied to your account one time after your first
            login. Future changes will save automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {mode === 'sign-up' && (
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Name
              </span>

              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 focus-within:border-yellow-300/50">
                <UserRound className="size-5 text-yellow-300" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                  className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </label>
          )}

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Email
            </span>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 focus-within:border-yellow-300/50">
              <Mail className="size-5 text-yellow-300" />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-600"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Password
            </span>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 focus-within:border-yellow-300/50">
              <Lock className="size-5 text-yellow-300" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 6 characters"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-600"
              />
            </div>
          </label>

          {message && (
            <p className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-100">
              {message}
            </p>
          )}

          {errorMessage && (
            <p className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-yellow-300 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950 transition hover:-translate-y-0.5 hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? 'Please wait...'
              : mode === 'sign-in'
                ? 'Sign in'
                : 'Create account'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode((currentMode) => (currentMode === 'sign-in' ? 'sign-up' : 'sign-in'))
              setMessage(null)
              setErrorMessage(null)
            }}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10"
          >
            {mode === 'sign-in'
              ? 'Need an account? Register'
              : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
