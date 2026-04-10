import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '../components/Button'
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
    await refreshProfile()
    if (role === 'student') navigate(from || '/student', { replace: true })
    else if (role === 'faculty') navigate(from || '/faculty', { replace: true })
    else navigate('/', { replace: true })
  }

  async function handleLogin() {
    setError(null); setLoading(true)
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
    setError(null); setLoading(true)
    try {
      if (!role) throw new Error('Select Student or Faculty to continue')
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || email.split('@')[0], email, password, role }),
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

  const roleCard = (r: 'student' | 'faculty', icon: string, title: string, desc: string) => (
    <button
      type="button"
      onClick={() => setRole(r)}
      style={{
        background: role === r ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
        border: role === r ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        padding: '18px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.2s',
        fontFamily: 'inherit',
        boxShadow: role === r ? '0 0 20px rgba(99,102,241,0.15)' : 'none',
      }}
      onMouseEnter={e => { if (role !== r) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)' }}
      onMouseLeave={e => { if (role !== r) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
    >
      <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: role === r ? '#a5b4fc' : '#e2e8f0', marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>{desc}</div>
    </button>
  )

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{
            fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #e2e8f0, #94a3b8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            margin: 0,
          }}>
            {mode === 'login' ? 'Welcome back' : 'Get started'}
          </h1>
          <p style={{ marginTop: '6px', fontSize: '0.875rem', color: '#475569' }}>
            Choose your role to continue.
          </p>
        </div>
        <Link to="/" style={{
          fontSize: '0.82rem', color: '#64748b', textDecoration: 'none',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px', padding: '6px 12px',
        }}>
          ← Back
        </Link>
      </div>

      {/* Role selection */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {roleCard('student', '🎓', 'Student', 'Join classrooms, view assignments, submit work.')}
        {roleCard('faculty', '👨‍🏫', 'Faculty', 'Create classrooms, upload materials, grade work.')}
      </div>

      {/* Mode tabs */}
      <div style={{
        display: 'flex',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        padding: '4px',
        gap: '4px',
      }}>
        {(['login', 'signup'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            style={{
              flex: 1,
              padding: '9px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              fontWeight: mode === m ? 600 : 400,
              transition: 'all 0.2s',
              background: mode === m
                ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.25))'
                : 'transparent',
              color: mode === m ? '#a5b4fc' : '#64748b',
              boxShadow: mode === m ? 'inset 0 0 0 1px rgba(99,102,241,0.3)' : 'none',
            }}
          >
            {m === 'login' ? 'Login' : 'Sign Up'}
          </button>
        ))}
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Form */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        {mode === 'signup' ? (
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        ) : null}

        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />

        <Button
          loading={loading}
          onClick={mode === 'login' ? handleLogin : handleSignup}
          type="button"
          style={{ width: '100%', marginTop: '4px' }}
        >
          {mode === 'login' ? 'Login →' : 'Create account →'}
        </Button>
      </div>
    </div>
  )
}
