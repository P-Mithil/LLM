import { Link, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from './AuthContext'

export function AppShell() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen" style={{ background: '#0f1117' }}>
      {/* Navbar */}
      <header style={{
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <span style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #818cf8, #c084fc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em',
            }}>
              ✦ ClassroomAI
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {profile ? (
              <>
                <div style={{
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '9999px',
                  padding: '4px 12px',
                }}>
                  {profile.name} · <span style={{ color: '#a78bfa', textTransform: 'capitalize' }}>{profile.role}</span>
                </div>
                <button
                  onClick={async () => { await signOut(); navigate('/') }}
                  style={{
                    fontSize: '0.8rem',
                    color: '#94a3b8',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/auth" style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#fff',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                borderRadius: '8px',
                padding: '7px 18px',
                textDecoration: 'none',
                boxShadow: '0 0 20px rgba(99,102,241,0.3)',
              }}>
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}


