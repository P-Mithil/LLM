import { useEffect, useState } from 'react'

import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { Input } from '../components/Input'
import { Loading } from '../components/Loading'
import { SectionHeader } from '../components/SectionHeader'
import { Badge } from '../components/Badge'
import { ClassroomCard } from '../features/classrooms/ClassroomCard'
import type { Classroom } from '../features/classrooms/types'
import { apiFetch } from '../lib/api'

type StudyPlanResponse = {
  answer: string
  steps: string[]
  tips: string[]
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  padding: '20px',
}

const sectionLabel: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '12px',
}

export function StudentDashboard() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
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

  useEffect(() => { load() }, [])

  async function join() {
    setError(null)
    setJoining(true)
    try {
      await apiFetch('/classrooms/join', { method: 'POST', body: JSON.stringify({ class_code: joinCode }) })
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
      const weak_areas = weakAreasText.split(',').map((s) => s.trim()).filter(Boolean)
      const deadlines = deadlinesText.split('\n').map((s) => s.trim()).filter(Boolean).map((line) => {
        const [label, date] = line.split('|').map((x) => x.trim())
        return { label: label || 'Deadline', date: date || '' }
      })
      const res = await apiFetch<StudyPlanResponse>('/ai/study-plan', {
        method: 'POST',
        body: JSON.stringify({ weak_areas, deadlines, hours_per_day: 2 }),
      })
      setPlan(res)
    } catch (e) {
      setError((e as { message?: string })?.message || 'Study plan failed')
    } finally {
      setPlanning(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <SectionHeader
        title="Student Dashboard"
        subtitle="Join classes, view assignments, and submit your work."
        right={<Badge>Student</Badge>}
      />

      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <Loading /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Join a class */}
        <div style={cardStyle}>
          <div style={sectionLabel}>🔑 Join a Class</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input
              label="Class code"
              placeholder="ABC1234"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#475569' }}>Ask your faculty for the code.</span>
              <Button loading={joining} onClick={join} type="button">
                Join
              </Button>
            </div>
          </div>
        </div>

        {/* AI Study Plan */}
        <div style={cardStyle}>
          <div style={sectionLabel}>✦ AI Personal Study Plan</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input
              label="Weak areas (comma separated)"
              placeholder="e.g. Algebra, Differentiation, Vectors"
              value={weakAreasText}
              onChange={(e) => setWeakAreasText(e.target.value)}
            />
            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Deadlines (one per line, format: Label | YYYY-MM-DD)
              </label>
              <textarea
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '0.875rem',
                  color: '#e2e8f0',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  minHeight: '80px',
                  resize: 'vertical',
                }}
                placeholder={'Midterm | 2026-04-20\nAssignment 2 | 2026-04-12'}
                value={deadlinesText}
                onChange={(e) => setDeadlinesText(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" loading={planning} onClick={generateStudyPlan} type="button">
                Generate plan
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Study Plan Result */}
      {plan ? (
        <div style={{
          background: 'rgba(99,102,241,0.07)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: '16px',
          padding: '20px',
        }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#a5b4fc', marginBottom: '12px' }}>
            ✦ Your Study Plan
          </div>
          <div style={{ fontSize: '0.875rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{plan.answer}</div>
          {plan.steps?.length ? (
            <ul style={{ margin: '12px 0 0', paddingLeft: '20px', fontSize: '0.875rem', color: '#64748b', lineHeight: 1.8 }}>
              {plan.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          ) : null}
          {plan.tips?.length ? (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Tips</div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#475569', lineHeight: 1.8 }}>
                {plan.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Classrooms */}
      {!loading && classrooms.length === 0 ? (
        <EmptyState title="No classrooms yet" subtitle="Join a classroom using the class code to see it here." />
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {classrooms.map((c) => (
          <ClassroomCard key={c.id} classroom={c} />
        ))}
      </div>
    </div>
  )
}
