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
  max_marks: number | null
  created_at: string
}

type EvaluationResult = {
  message: string
  feedback: string
}

type Submission = {
  id: string
  assignment_id: string
  student_id: string
  file_url: string
  evaluation_feedback: string | null
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
  const [newMaxMarks, setNewMaxMarks] = useState('')
  const [newFileUrl, setNewFileUrl] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [evaluatingSubmission, setEvaluatingSubmission] = useState<string | null>(null)
  const [evaluationResults, setEvaluationResults] = useState<Record<string, string>>({})

  const [submissionsByAssignment, setSubmissionsByAssignment] = useState<Record<string, Submission[]>>({})
  const [loadingSubmissionsFor, setLoadingSubmissionsFor] = useState<string | null>(null)

  // Student's own submissions keyed by assignment id
  const [mySubmissions, setMySubmissions] = useState<Record<string, Submission | null>>({})

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

      // If student, load their own submission for each assignment
      if (effectiveRole === 'student') {
        const mine: Record<string, Submission | null> = {}
        await Promise.all(
          a.map(async (assignment) => {
            try {
              const sub = await apiFetch<Submission | null>(`/assignments/${assignment.id}/my-submission`)
              mine[assignment.id] = sub
            } catch {
              mine[assignment.id] = null
            }
          })
        )
        setMySubmissions(mine)
      }
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
          file_url: newFileUrl || null,
          max_marks: newMaxMarks ? parseInt(newMaxMarks) : null,
        }),
      })
      setNewTitle('')
      setNewDesc('')
      setNewDeadline('')
      setNewMaxMarks('')
      setNewFileUrl(null)
      await load()
    } catch (e) {
      setError((e as { message?: string })?.message || 'Failed to create assignment')
    } finally {
      setCreating(false)
    }
  }

  async function evaluateSubmission(assignmentId: string, submissionId: string) {
    setError(null)
    setEvaluatingSubmission(submissionId)
    try {
      const result = await apiFetch<EvaluationResult>(
        `/assignments/${assignmentId}/submissions/${submissionId}/evaluate`,
        { method: 'POST' }
      )
      setEvaluationResults((prev) => ({ ...prev, [submissionId]: result.feedback }))
      // Refresh submissions to get saved feedback
      await loadSubmissions(assignmentId)
    } catch (e) {
      setError((e as { message?: string })?.message || 'Evaluation failed')
    } finally {
      setEvaluatingSubmission(null)
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
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">
                    Description / Evaluation Guidance
                    <span className="ml-1 text-slate-400">(used by AI to grade submissions)</span>
                  </label>
                  <textarea
                    className="min-h-[100px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="Describe what students should cover, key concepts expected, examples required, etc."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
                <Input
                  label="Max Marks"
                  type="number"
                  value={newMaxMarks}
                  onChange={(e) => setNewMaxMarks(e.target.value)}
                  placeholder="e.g. 100"
                />
                <Input
                  label="Deadline (optional)"
                  type="datetime-local"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                />
                {/* Question paper / reference file upload */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">
                    Question Paper / Reference File
                    <span className="ml-1 text-slate-400">(optional — AI will read this too)</span>
                  </label>
                  {newFileUrl ? (
                    <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
                      <span className="flex-1 truncate text-xs text-green-700">✅ File uploaded</span>
                      <a href={newFileUrl} target="_blank" rel="noreferrer" className="text-xs text-slate-600 underline">Preview</a>
                      <button onClick={() => setNewFileUrl(null)} className="text-xs text-red-500 hover:underline">Remove</button>
                    </div>
                  ) : (
                    <FileUpload
                      label="Upload question file"
                      bucket="assignments"
                      pathPrefix={`questions/${classroomId}`}
                      onUploaded={(url) => setNewFileUrl(url)}
                    />
                  )}
                </div>
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
                    <div className="flex items-start justify-between">
                      <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                      {a.max_marks ? (
                        <span className="text-xs font-medium text-slate-500">{a.max_marks} marks</span>
                      ) : null}
                    </div>
                    {a.description ? (
                      <div className="text-sm text-slate-600">{a.description}</div>
                    ) : null}
                    {/* Question file link */}
                    {a.file_url ? (
                      <a
                        href={a.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        📄 View Question Paper
                      </a>
                    ) : null}
                    {a.deadline ? (
                      <div className="text-xs text-slate-500">
                        Deadline: {new Date(a.deadline).toLocaleString()}
                      </div>
                    ) : null}

                    {isStudent ? (() => {
                      const isPastDeadline = a.deadline ? new Date() > new Date(a.deadline) : false
                      const mySub = mySubmissions[a.id]
                      return (
                        <div className="space-y-3">
                          {/* Deadline warning */}
                          {isPastDeadline && (
                            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 font-medium">
                              ⛔ Deadline has passed. Submissions are closed.
                            </div>
                          )}

                          {/* Upload section — hidden after deadline */}
                          {!isPastDeadline && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <FileUpload
                                label={mySub ? 'Re-submit file' : 'Submit file'}
                                bucket="submissions"
                                pathPrefix={`submissions/${a.id}`}
                                onUploaded={async (url) => {
                                  try {
                                    await apiFetch(`/assignments/${a.id}/submissions`, {
                                      method: 'POST',
                                      body: JSON.stringify({ file_url: url }),
                                    })
                                    // Refresh my submission
                                    const sub = await apiFetch<Submission | null>(`/assignments/${a.id}/my-submission`)
                                    setMySubmissions((prev) => ({ ...prev, [a.id]: sub }))
                                  } catch (e) {
                                    setError((e as { message?: string })?.message || 'Submission failed')
                                  }
                                }}
                              />
                            </div>
                          )}

                          {/* Submitted info */}
                          {mySub && (
                            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                              ✅ Submitted on {new Date(mySub.submitted_at).toLocaleString()}
                            </div>
                          )}

                          {/* Evaluation feedback */}
                          {mySub?.evaluation_feedback && (
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-1">
                              <div className="text-xs font-bold text-indigo-800 uppercase tracking-wide">📋 Your Result</div>
                              <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans">{mySub.evaluation_feedback}</pre>
                            </div>
                          )}
                        </div>
                      )
                    })() : null}

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
                              className="space-y-2 rounded-md border border-slate-200 bg-white px-3 py-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-slate-600">
                                  {s.student_id} · {new Date(s.submitted_at).toLocaleString()}
                                </div>
                                <div className="flex gap-2">
                                  <a
                                    className="text-sm font-medium text-slate-900 underline underline-offset-4"
                                    href={s.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Download
                                  </a>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    loading={evaluatingSubmission === s.id}
                                    onClick={() => evaluateSubmission(a.id, s.id)}
                                    type="button"
                                  >
                                    ✦ Evaluate
                                  </Button>
                                </div>
                              </div>
                              {(evaluationResults[s.id] || s.evaluation_feedback) ? (
                                <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 whitespace-pre-wrap">
                                  <div className="mb-1 font-semibold text-slate-900">AI Evaluation</div>
                                  {evaluationResults[s.id] || s.evaluation_feedback}
                                </div>
                              ) : null}
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

