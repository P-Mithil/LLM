import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { Input } from '../components/Input'
import { Loading } from '../components/Loading'
import { FileUpload } from '../components/FileUpload'
import { SectionHeader } from '../components/SectionHeader'
import { useAuth } from '../app/AuthContext'
import type { Classroom } from '../features/classrooms/types'
import { ChatPanel } from '../features/chat/ChatPanel'
import { apiFetch } from '../lib/api'

type Assignment = {
  id: string
  classroom_id: string
  title: string
  description: string | null
  deadline: string | null
  file_url: string | null
  created_at: string
}

type Submission = {
  id: string
  assignment_id: string
  student_id: string
  file_url: string
  submitted_at: string
}

export function ClassroomPage() {
  const { id } = useParams()
  const classroomId = id || ''
  const { profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])

  const effectiveRole = profile?.role || null
  const isFaculty = effectiveRole === 'faculty'
  const isStudent = effectiveRole === 'student'

  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [creating, setCreating] = useState(false)

  const [submissionsByAssignment, setSubmissionsByAssignment] = useState<Record<string, Submission[]>>({})
  const [loadingSubmissionsFor, setLoadingSubmissionsFor] = useState<string | null>(null)

  const deadlineIso = useMemo(() => {
    if (!newDeadline) return null
    const d = new Date(newDeadline)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString()
  }, [newDeadline])

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const c = await apiFetch<Classroom>(`/classrooms/${classroomId}`)
      const a = await apiFetch<Assignment[]>(`/classrooms/${classroomId}/assignments`)
      setClassroom(c)
      setAssignments(a)
    } catch (e) {
      setError((e as { message?: string })?.message || 'Failed to load classroom')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!classroomId) return
    load()
  }, [classroomId])

  async function createAssignment() {
    setError(null)
    setCreating(true)
    try {
      await apiFetch(`/classrooms/${classroomId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          description: newDesc || null,
          deadline: deadlineIso,
          file_url: null,
        }),
      })
      setNewTitle('')
      setNewDesc('')
      setNewDeadline('')
      await load()
    } catch (e) {
      setError((e as { message?: string })?.message || 'Failed to create assignment')
    } finally {
      setCreating(false)
    }
  }

  async function loadSubmissions(assignmentId: string) {
    setError(null)
    setLoadingSubmissionsFor(assignmentId)
    try {
      const rows = await apiFetch<Submission[]>(`/assignments/${assignmentId}/submissions`)
      setSubmissionsByAssignment((prev) => ({ ...prev, [assignmentId]: rows }))
    } catch (e) {
      setError((e as { message?: string })?.message || 'Failed to load submissions')
    } finally {
      setLoadingSubmissionsFor(null)
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorBanner message={error} />
  if (!classroom) return <ErrorBanner message="Classroom not found." />

  return (
    <div className="space-y-6">
      <SectionHeader
        title={classroom.course_name}
        subtitle={classroom.description || 'No description'}
        right={
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <Badge variant="indigo">{classroom.course_code}</Badge>
            <Badge>Code: {classroom.class_code}</Badge>
            {classroom.syllabus_url ? (
              <a
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm"
                href={classroom.syllabus_url}
                target="_blank"
                rel="noreferrer"
              >
                Syllabus
              </a>
            ) : null}
          </div>
        }
      />

      <div className="text-sm text-slate-500">
        <Link to={isStudent ? '/student' : '/faculty'} className="underline underline-offset-4">
          Back to dashboard
        </Link>
      </div>

      <Card>
        <div className="text-sm font-semibold text-slate-900">Stream</div>
        <div className="mt-1 text-sm text-slate-600">
          Announcements placeholder (MVP).
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Assignments</div>
              {isFaculty ? <Badge>Faculty view</Badge> : <Badge>Student view</Badge>}
            </div>

            {isFaculty ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-700">Create assignment</div>
                <Input label="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                <Input
                  label="Description (optional)"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
                <Input
                  label="Deadline (optional)"
                  type="datetime-local"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button loading={creating} onClick={createAssignment} type="button">
                    Create
                  </Button>
                </div>
              </div>
            ) : null}

            {assignments.length === 0 ? (
              <EmptyState title="No assignments yet" subtitle="When faculty posts assignments, they’ll show up here." />
            ) : (
              <div className="space-y-3">
                {assignments.map((a) => (
                  <Card key={a.id} className="space-y-2">
                    <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                    {a.description ? (
                      <div className="text-sm text-slate-600">{a.description}</div>
                    ) : null}
                    {a.deadline ? (
                      <div className="text-xs text-slate-500">
                        Deadline: {new Date(a.deadline).toLocaleString()}
                      </div>
                    ) : null}

                    {isStudent ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <FileUpload
                          label="Submit file"
                          bucket="submissions"
                          pathPrefix={`submissions/${a.id}`}
                          onUploaded={async (url) => {
                            try {
                              await apiFetch(`/assignments/${a.id}/submissions`, {
                                method: 'POST',
                                body: JSON.stringify({ file_url: url }),
                              })
                            } catch (e) {
                              setError((e as { message?: string })?.message || 'Submission failed')
                            }
                          }}
                        />
                      </div>
                    ) : null}

                    {isFaculty ? (
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500">Submissions</div>
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={loadingSubmissionsFor === a.id}
                          onClick={() => loadSubmissions(a.id)}
                          type="button"
                        >
                          View
                        </Button>
                      </div>
                    ) : null}

                    {isFaculty && submissionsByAssignment[a.id] ? (
                      <div className="space-y-2">
                        {submissionsByAssignment[a.id].length === 0 ? (
                          <div className="text-sm text-slate-600">No submissions yet.</div>
                        ) : (
                          submissionsByAssignment[a.id].map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2"
                            >
                              <div className="text-xs text-slate-600">
                                {s.student_id} · {new Date(s.submitted_at).toLocaleString()}
                              </div>
                              <a
                                className="text-sm font-medium text-slate-900 underline underline-offset-4"
                                href={s.file_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Download
                              </a>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <ChatPanel classroomId={classroomId} />
        </div>
      </div>
    </div>
  )
}

