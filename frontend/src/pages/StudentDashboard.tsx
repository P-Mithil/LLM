import { useEffect, useState } from 'react'

import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { Input } from '../components/Input'
import { Loading } from '../components/Loading'
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
  const [weakAreasText, setWeakAreasText] = useState('')
  const [deadlinesText, setDeadlinesText] = useState('')
  const [planning, setPlanning] = useState(false)
  const [plan, setPlan] = useState<StudyPlanResponse | null>(null)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)

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
      setShowJoinModal(false)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: '100%' }}>

      {/* ── Top hero banner ───────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
        borderRadius: '16px',
        padding: '32px 32px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '28px',
        border: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative glows */}
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '30%', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            My Classrooms
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: '#64748b' }}>
            {classrooms.length > 0
              ? `You're enrolled in ${classrooms.length} ${classrooms.length === 1 ? 'class' : 'classes'}`
              : 'Join a class to get started'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
          <button
            onClick={() => setShowPlanModal(true)}
            style={{
              padding: '9px 18px',
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '8px',
              color: '#a5b4fc',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.25)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.15)' }}
          >
            ✦ AI Study Plan
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            style={{
              padding: '9px 20px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
          >
            + Join Class
          </button>
        </div>
      </div>

      {/* ── Error banner ───────────────────────────────────── */}
      {error ? <ErrorBanner message={error} /> : null}

      {/* ── Loading ────────────────────────────────────────── */}
      {loading ? <Loading /> : null}

      {/* ── Empty state ────────────────────────────────────── */}
      {!loading && classrooms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📚</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
            No classrooms yet
          </div>
          <div style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '24px' }}>
            Ask your faculty for a class code and join your first classroom.
          </div>
          <button
            onClick={() => setShowJoinModal(true)}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + Join a Class
          </button>
        </div>
      ) : null}

      {/* ── Classroom grid (Google Classroom style) ────────── */}
      {!loading && classrooms.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '20px',
        }}>
          {classrooms.map((c) => (
            <ClassroomCard key={c.id} classroom={c} />
          ))}
        </div>
      ) : null}

      {/* ── Study Plan Result ──────────────────────────────── */}
      {plan && showPlanModal ? (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px',
        }}
          onClick={() => { setShowPlanModal(false); setPlan(null) }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1e1e2e',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '620px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#a5b4fc', marginBottom: '16px' }}>
              ✦ Your AI Study Plan
            </div>
            <div style={{ fontSize: '0.875rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{plan.answer}</div>
            {plan.steps?.length ? (
              <ul style={{ margin: '12px 0 0', paddingLeft: '20px', fontSize: '0.875rem', color: '#64748b', lineHeight: 1.8 }}>
                {plan.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            ) : null}
            {plan.tips?.length ? (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Tips</div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#475569', lineHeight: 1.8 }}>
                  {plan.tips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            ) : null}
            <button
              onClick={() => { setShowPlanModal(false); setPlan(null) }}
              style={{ marginTop: '20px', padding: '8px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Join Class Modal ───────────────────────────────── */}
      {showJoinModal ? (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}
          onClick={() => setShowJoinModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px', maxWidth: '400px', width: '100%' }}
          >
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#e2e8f0', marginBottom: '4px' }}>Join a Class</div>
            <div style={{ fontSize: '0.83rem', color: '#475569', marginBottom: '20px' }}>Enter the class code shared by your faculty.</div>
            <Input
              label="Class code"
              placeholder="e.g. ABC1234"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setShowJoinModal(false)}
                style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
              <Button loading={joining} onClick={join} type="button">
                Join →
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── AI Study Plan Modal ────────────────────────────── */}
      {showPlanModal && !plan ? (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}
          onClick={() => setShowPlanModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#1e1e2e', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%' }}
          >
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#a5b4fc', marginBottom: '4px' }}>✦ AI Personal Study Plan</div>
            <div style={{ fontSize: '0.83rem', color: '#475569', marginBottom: '20px' }}>Tell us your weak spots and upcoming deadlines.</div>
            <Input
              label="Weak areas (comma separated)"
              placeholder="e.g. Algebra, Differentiation, Vectors"
              value={weakAreasText}
              onChange={(e) => setWeakAreasText(e.target.value)}
            />
            <div style={{ marginTop: '14px' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Deadlines (one per line: Label | YYYY-MM-DD)
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
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setShowPlanModal(false)}
                style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
              <Button variant="secondary" loading={planning} onClick={generateStudyPlan} type="button">
                Generate plan
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
