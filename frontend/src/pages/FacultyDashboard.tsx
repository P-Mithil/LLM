import { useEffect, useState } from 'react'

import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
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

  useEffect(() => {
    load()
  }, [])

  async function create() {
    setError(null)
    setCreating(true)
    try {
      const created = await apiFetch<Classroom>('/classrooms', {
        method: 'POST',
        body: JSON.stringify({
          course_name: courseName,
          course_code: courseCode,
          description,
          syllabus_url: syllabusUrl,
        }),
      })

      // If faculty uploaded syllabus, index it for the AI Tutor (optional but recommended)
      if (syllabusUrl) {
        setIndexingSyllabus(true)
        try {
          await apiFetch(`/ai/classrooms/${created.id}/materials`, {
            method: 'POST',
            body: JSON.stringify({
              kind: 'syllabus',
              title: `${courseCode || 'Course'} syllabus`,
              source_url: syllabusUrl,
            }),
          })
        } catch {
          // Non-fatal: classroom is created even if indexing fails
        } finally {
          setIndexingSyllabus(false)
        }
      }

      setCourseName('')
      setCourseCode('')
      setDescription('')
      setSyllabusUrl(null)
      await load()
    } catch (e) {
      setError((e as { message?: string })?.message || 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Faculty Dashboard"
        subtitle="Create classrooms, upload syllabus, and post assignments."
      />

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Create a classroom</div>
          <Badge>Faculty</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Course name" value={courseName} onChange={(e) => setCourseName(e.target.value)} />
          <Input label="Course code" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
        </div>
        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <FileUpload
            label="Syllabus (optional)"
            bucket="syllabi"
            pathPrefix={`syllabi/${courseCode || 'course'}`}
            onUploaded={(url) => setSyllabusUrl(url)}
          />
          {syllabusUrl ? (
            <div className="mt-2 text-xs text-slate-600">
              Uploaded:{' '}
              <a
                className="underline underline-offset-4"
                href={syllabusUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open syllabus
              </a>
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">A class code is generated automatically.</div>
          <Button loading={creating || indexingSyllabus} onClick={create} type="button">
            Create
          </Button>
        </div>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <Loading /> : null}

      {!loading && classrooms.length === 0 ? (
        <EmptyState title="No classrooms yet" subtitle="Create your first classroom using the form above." />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {classrooms.map((c) => (
          <ClassroomCard key={c.id} classroom={c} />
        ))}
      </div>
    </div>
  )
}

