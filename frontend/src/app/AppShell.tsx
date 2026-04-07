import { Link, Outlet, useNavigate } from 'react-router-dom'

import { Button } from '../components/Button'
import { useAuth } from './AuthContext'

export function AppShell() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-sm font-semibold text-slate-900">
            Classroom MVP
          </Link>

          <div className="flex items-center gap-3">
            {profile ? (
              <>
                <div className="text-sm text-slate-600">
                  {profile.name} · <span className="capitalize">{profile.role}</span>
                </div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await signOut()
                    navigate('/')
                  }}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <Link to="/auth" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

