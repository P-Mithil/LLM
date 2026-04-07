import { useEffect, useState } from 'react'

import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { Input } from '../components/Input'
import { Loading } from '../components/Loading'
import { SectionHeader } from '../components/SectionHeader'
import { ClassroomCard } from '../features/classrooms/ClassroomCard'
import type { Classroom } from '../features/classrooms/types'
import { apiFetch } from '../lib/api'

export function StudentDashboard() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const rows = await apiFetch<Classroom[]>('/classrooms')
      setClassrooms(rows)
    } catch (e) {
      setError((e as { message?: string })?.message || 'Failed to load classrooms')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function join() {
    setError(null)
    setJoining(true)
    try {
      await apiFetch('/classrooms/join', {
        method: 'POST',
        body: JSON.stringify({ class_code: joinCode }),
      })
      setJoinCode('')
      await load()
    } catch (e) {
      setError((e as { message?: string })?.message || 'Join failed')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Student Dashboard"
        subtitle="Join classes, view assignments, and submit your work."
      />

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? <Loading /> : null}

      <Card className="space-y-3">
        <div className="text-sm font-semibold text-slate-900">Join a class</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Class code"
              placeholder="ABC1234"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
          </div>
          <Button loading={joining} onClick={join} type="button" className="sm:w-32">
            Join
          </Button>
        </div>
        <div className="text-xs text-slate-500">
          Ask your faculty for the class code (it’s unique for each classroom).
        </div>
      </Card>

      {!loading && classrooms.length === 0 ? (
        <EmptyState
          title="No classrooms yet"
          subtitle="Join a classroom using the class code to see it here."
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {classrooms.map((c) => (
          <ClassroomCard key={c.id} classroom={c} />
        ))}
      </div>
    </div>
  )
}

