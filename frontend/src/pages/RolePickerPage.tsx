import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useDevRole } from '../app/DevRoleContext'

export function RolePickerPage() {
  const { role, setRole } = useDevRole()
  const navigate = useNavigate()

  useEffect(() => {
    if (!role) return
    navigate(role === 'student' ? '/student' : '/faculty', { replace: true })
  }, [role, navigate])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Choose a role</h1>
        <p className="mt-1 text-sm text-slate-600">
          Dev mode: no login. Pick Student or Faculty to continue.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="space-y-3">
          <div className="text-sm font-semibold text-slate-900">Student</div>
          <div className="text-sm text-slate-600">
            Join classes by code and submit assignments.
          </div>
          <Button onClick={() => setRole('student')}>Continue</Button>
        </Card>

        <Card className="space-y-3">
          <div className="text-sm font-semibold text-slate-900">Faculty</div>
          <div className="text-sm text-slate-600">
            Create classes, upload syllabus, and post assignments.
          </div>
          <Button variant="secondary" onClick={() => setRole('faculty')}>
            Continue
          </Button>
        </Card>
      </div>
    </div>
  )
}

