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

type StudyPlanResponse = {
  answer: string
  steps: string[]
  tips: string[]
}

export function StudentDashboard() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)

  // AI study plan
  const [weakAreasText, setWeakAreasText] = useState('')
  const [deadlinesText, setDeadlinesText] = useState('')
  const [planning, setPlanning] = useState(false)
  const [plan, setPlan] = useState<StudyPlanResponse | null>(null)

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

  async function generateStudyPlan() {
    setError(null)
    setPlanning(true)
    setPlan(null)
    try {
      const weak_areas = weakAreasText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const deadlines = deadlinesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((line) => {
          const [label, date] = line.split('|').map((x) => x.trim())
          return { label: label || 'Deadline', date: date || '' }
        })

      const res = await apiFetch<StudyPlanResponse>('/ai/study-plan', {
        method: 'POST',
        body: JSON.stringify({
          weak_areas,
          deadlines,
          hours_per_day: 2,
        }),
      })
      setPlan(res)
    } catch (e) {
      setError((e as { message?: string })?.message || 'Study plan failed')
    } finally {
      setPlanning(false)
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

      <Card className="space-y-3">
        <div className="text-sm font-semibold text-slate-900">AI Personal Study Plan</div>
        <div className="text-xs text-slate-600">
          Enter your weak areas and deadlines. Format deadlines as: <span className="font-mono">Label | YYYY-MM-DD</span>
        </div>

        <Input
          label="Weak areas (comma separated)"
          placeholder="e.g. Algebra, Differentiation, Vectors"
          value={weakAreasText}
          onChange={(e) => setWeakAreasText(e.target.value)}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Deadlines (one per line)</label>
          <textarea
            className="min-h-[90px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder={'Midterm | 2026-04-20\nAssignment 2 | 2026-04-12'}
            value={deadlinesText}
            onChange={(e) => setDeadlinesText(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" loading={planning} onClick={generateStudyPlan} type="button">
            Generate plan
          </Button>
        </div>

        {plan ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="text-sm font-semibold text-slate-900">Your plan</div>
            <div className="text-sm text-slate-800 whitespace-pre-wrap">{plan.answer}</div>
            {plan.steps?.length ? (
              <ul className="list-disc pl-5 text-sm text-slate-700">
                {plan.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : null}
            {plan.tips?.length ? (
              <div className="text-sm text-slate-700">
                <div className="text-xs font-semibold text-slate-900">Tips</div>
                <ul className="list-disc pl-5">
                  {plan.tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
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

