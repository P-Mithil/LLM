import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Loading } from '../components/Loading'
import { useAuth } from './AuthContext'

export function RoleGate({
  role,
  children,
}: {
  role: 'student' | 'faculty' | 'any'
  children: React.ReactNode
}) {
  const { loading, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (loading) return
    if (!profile) {
      navigate('/auth', { replace: true, state: { from: location.pathname } })
      return
    }
    if (role !== 'any' && profile.role !== role) {
      navigate(profile.role === 'student' ? '/student' : '/faculty', { replace: true })
    }
  }, [loading, profile, role, navigate, location.pathname])

  if (loading) return <Loading />
  if (!profile) return <Loading label="Redirecting…" />
  if (role !== 'any' && profile.role !== role) return <Loading label="Redirecting…" />

  return children
}

