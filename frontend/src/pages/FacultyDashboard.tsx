import { useEffect, useState } from 'react'

import { Button } from '../components/Button'
import { ErrorBanner } from '../components/ErrorBanner'
import { FileUpload } from '../components/FileUpload'
import { Input } from '../components/Input'
import { Loading } from '../components/Loading'
import { ClassroomCard } from '../features/classrooms/ClassroomCard'
import type { Classroom } from '../features/classrooms/types'
import { apiFetch } from '../lib/api'

export function FacultyDashboard() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const [courseName, setCourseName] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [description, setDescription] = useState('')
  const [syllabusUrl, setSyllabusUrl] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [indexingSyllabus, setIndexingSyllabus] = useState(false)

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

  async function create() {
    setError(null)
    setCreating(true)
    try {
      const created = await apiFetch<Classroom>('/classrooms', {
        method: 'POST',
        body: JSON.stringify({ course_name: courseName, course_code: courseCode, description, syllabus_url: syllabusUrl }),
      })

      if (syllabusUrl) {
        setIndexingSyllabus(true)
        try {
          await apiFetch(`/ai/classrooms/${created.id}/materials`, {
            method: 'POST',
            body: JSON.stringify({ kind: 'syllabus', title: `${courseCode || 'Course'} syllabus`, source_url: syllabusUrl }),
          })
        } catch { /* non-fatal */ } finally {
          setIndexingSyllabus(false)
        }
      }

      setCourseName(''); setCourseCode(''); setDescription(''); setSyllabusUrl(null)
      setShowModal(false)
      await load()
    } catch (e) {
      setError((e as { message?: string })?.message || 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Hero banner ─────────────────────────────────────── */}
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
        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '30%', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            My Classrooms
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: '#64748b' }}>
            {classrooms.length > 0
              ? `You're teaching ${classrooms.length} ${classrooms.length === 1 ? 'class' : 'classes'}`
              : 'Create your first classroom to get started'}
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          style={{
            position: 'relative',
            padding: '10px 22px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
        >
          + Create Classroom
        </button>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {/* ── Loading ─────────────────────────────────────────── */}
      {loading ? <Loading /> : null}

      {/* ── Empty state ─────────────────────────────────────── */}
      {!loading && classrooms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏫</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
            No classrooms yet
          </div>
          <div style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '24px' }}>
            Create your first classroom and start teaching.
          </div>
          <button
            onClick={() => setShowModal(true)}
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
            + Create Classroom
          </button>
        </div>
      ) : null}

      {/* ── Classroom grid ──────────────────────────────────── */}
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

      {/* ── Create Classroom Modal ───────────────────────────── */}
      {showModal ? (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '20px',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1e1e2e',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              padding: '28px',
              maxWidth: '520px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              boxShadow: '0 25px 80px rgba(0,0,0,0.5)',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>Create a Classroom</div>
                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                  A class code is generated automatically.
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                }}
              >
                ✕
              </button>
            </div>

            {/* Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Input label="Course name" value={courseName} onChange={(e) => setCourseName(e.target.value)} />
              <Input label="Course code" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
            </div>
            <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />

            {/* Syllabus upload */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '14px',
            }}>
              <FileUpload
                label="Syllabus (optional PDF)"
                bucket="syllabi"
                pathPrefix={`syllabi/${courseCode || 'course'}`}
                onUploaded={(url) => setSyllabusUrl(url)}
              />
              {syllabusUrl ? (
                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                  ✅ Uploaded —{' '}
                  <a href={syllabusUrl} target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>
                    Open syllabus
                  </a>
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '9px 18px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <Button loading={creating || indexingSyllabus} onClick={create} type="button">
                Create Classroom
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
