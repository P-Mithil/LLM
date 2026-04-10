import { useEffect, useState } from 'react'

import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { FileUpload } from '../components/FileUpload'
import { Input } from '../components/Input'
import { Loading } from '../components/Loading'
import { SectionHeader } from '../components/SectionHeader'
import { ClassroomCard } from '../features/classrooms/ClassroomCard'
import type { Classroom } from '../features/classrooms/types'
import { apiFetch } from '../lib/api'

export function FacultyDashboard() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      await load()
    } catch (e) {
      setError((e as { message?: string })?.message || 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <SectionHeader
        title="Faculty Dashboard"
        subtitle="Create classrooms, upload syllabus, and post assignments."
        right={<Badge variant="indigo">Faculty</Badge>}
      />

      {error ? <ErrorBanner message={error} /> : null}

      {/* Create classroom card */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '24px',
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
          ＋ Create a Classroom
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Input label="Course name" value={courseName} onChange={(e) => setCourseName(e.target.value)} />
            <Input label="Course code" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
          </div>
          <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />

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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: '#475569' }}>A class code is generated automatically.</span>
            <Button loading={creating || indexingSyllabus} onClick={create} type="button">
              Create Classroom
            </Button>
          </div>
        </div>
      </div>

      {/* Classrooms grid */}
      {loading ? <Loading /> : null}
      {!loading && classrooms.length === 0 ? (
        <EmptyState title="No classrooms yet" subtitle="Create your first classroom using the form above." />
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {classrooms.map((c) => (
          <ClassroomCard key={c.id} classroom={c} />
        ))}
      </div>
    </div>
  )
}
