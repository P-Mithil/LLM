import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ErrorBanner } from '../components/ErrorBanner'
import { Input } from '../components/Input'
import { useAuth } from '../app/AuthContext'
import { setStoredToken } from '../lib/api'

type Mode = 'login' | 'signup'

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'faculty' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { refreshProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()

  const from = useMemo(() => {
    const s = location.state as { from?: string } | null
    return s?.from || null
  }, [location.state])

  useEffect(() => {
    const qp = params.get('role')
    if (qp === 'student' || qp === 'faculty') setRole(qp)
  }, [params])

  async function afterAuthRedirect() {
    // Load profile (role) and send user to the right dashboard.
    await refreshProfile()
    // refreshProfile already loads role from /me
    // The RoleGate will enforce redirect if needed; we also send user to the chosen area.
    if (role === 'student') navigate(from || '/student', { replace: true })
    else if (role === 'faculty') navigate(from || '/faculty', { replace: true })
    else navigate('/', { replace: true })
  }

  async function handleLogin() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Login failed')
      setStoredToken(json.token)
      await afterAuthRedirect()
    } catch (e) {
      setError((e as { message?: string })?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup() {
    setError(null)
    setLoading(true)
    try {
      if (!role) throw new Error('Select Student or Faculty to continue')

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || email.split('@')[0],
          email,
          password,
          role,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Signup failed')
      setStoredToken(json.token)

      await afterAuthRedirect()
    } catch (e) {
      setError((e as { message?: string })?.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-600">
            Choose your role, then login or create an account.
          </p>
        </div>
        <Link
          to="/"
          className="text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
        >
          Back
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setRole('student')}
          className={[
            'rounded-2xl border bg-white p-5 text-left transition',
            role === 'student'
              ? 'border-slate-900 ring-2 ring-slate-300'
              : 'border-slate-200 hover:border-slate-300',
          ].join(' ')}
        >
          <div className="text-sm font-semibold text-slate-900">Student</div>
          <div className="mt-1 text-sm text-slate-600">
            Join classrooms with a code, view assignments, and submit work.
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRole('faculty')}
          className={[
            'rounded-2xl border bg-white p-5 text-left transition',
            role === 'faculty'
              ? 'border-slate-900 ring-2 ring-slate-300'
              : 'border-slate-200 hover:border-slate-300',
          ].join(' ')}
        >
          <div className="text-sm font-semibold text-slate-900">Faculty</div>
          <div className="mt-1 text-sm text-slate-600">
            Create classrooms, upload syllabus, and post assignments.
          </div>
        </button>
      </div>

      <div className="flex gap-2">
        <Button
          variant={mode === 'login' ? 'primary' : 'secondary'}
          className="flex-1"
          onClick={() => setMode('login')}
          type="button"
        >
          Login
        </Button>
        <Button
          variant={mode === 'signup' ? 'primary' : 'secondary'}
          className="flex-1"
          onClick={() => setMode('signup')}
          type="button"
        >
          Signup
        </Button>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <Card className="space-y-3">
        {mode === 'signup' ? (
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        ) : null}

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />

        <div className="pt-1">
          <Button
            className="w-full"
            loading={loading}
            onClick={mode === 'login' ? handleLogin : handleSignup}
            type="button"
          >
            {mode === 'login' ? 'Login' : 'Create account'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

