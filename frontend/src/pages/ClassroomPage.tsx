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
import { AiTutorPanel } from '../features/ai/AiTutorPanel'
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

type AssignmentHelpResponse = {
  answer: string
  steps: string[]
  tips: string[]
}

type GradeResponse = {
  answer: string
  marks: number
  steps: string[]
  tips: string[]
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

  // AI assignment helper
  const [aiForAssignment, setAiForAssignment] = useState<Assignment | null>(null)
  const [aiAttempt, setAiAttempt] = useState('')
  const [aiWantFinal, setAiWantFinal] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AssignmentHelpResponse | null>(null)

  // Faculty materials indexing + tools
  const [notesUrl, setNotesUrl] = useState<string | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryResult, setSummaryResult] = useState<AssignmentHelpResponse | null>(null)
  const [quizTopic, setQuizTopic] = useState('')
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizResult, setQuizResult] = useState<any | null>(null)

  const [gradeQ, setGradeQ] = useState('')
  const [gradeA, setGradeA] = useState('')
  const [gradeRubric, setGradeRubric] = useState('')
  const [gradeLoading, setGradeLoading] = useState(false)
  const [gradeResult, setGradeResult] = useState<GradeResponse | null>(null)

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

  async function askAiForAssignment() {
    if (!aiForAssignment) return
    setError(null)
    setAiLoading(true)
    setAiResult(null)
    try {
      const qParts = [aiForAssignment.title, aiForAssignment.description || ''].filter(Boolean)
      const question = qParts.join('\n\n')
      const res = await apiFetch<AssignmentHelpResponse>('/ai/assignment-help', {
        method: 'POST',
        body: JSON.stringify({
          question,
          attempt: aiAttempt || null,
          want_final: aiWantFinal,
        }),
      })
      setAiResult(res)
    } catch (e) {
      setError((e as { message?: string })?.message || 'AI help failed')
    } finally {
      setAiLoading(false)
    }
  }

  async function indexNotes(kind: 'syllabus' | 'notes', title: string, url: string) {
    setError(null)
    setIndexing(true)
    try {
      await apiFetch(`/ai/classrooms/${classroomId}/materials`, {
        method: 'POST',
        body: JSON.stringify({ kind, title, source_url: url }),
      })
    } catch (e) {
      setError((e as { message?: string })?.message || 'Indexing failed')
    } finally {
      setIndexing(false)
    }
  }

  async function summarizeNow() {
    const t = summaryText.trim()
    if (!t) return
    setError(null)
    setSummaryLoading(true)
    setSummaryResult(null)
    try {
      const res = await apiFetch<AssignmentHelpResponse>('/ai/summarize', {
        method: 'POST',
        body: JSON.stringify({ text: t, style: 'bullets', max_bullets: 10 }),
      })
      setSummaryResult(res)
    } catch (e) {
      setError((e as { message?: string })?.message || 'Summarize failed')
    } finally {
      setSummaryLoading(false)
    }
  }

  async function generateQuiz() {
    const t = quizTopic.trim()
    if (!t) return
    setError(null)
    setQuizLoading(true)
    setQuizResult(null)
    try {
      const res = await apiFetch<any>('/ai/generate-quiz', {
        method: 'POST',
        body: JSON.stringify({ topic: t, num_questions: 5, difficulty: 'medium' }),
      })
      setQuizResult(res)
    } catch (e) {
      setError((e as { message?: string })?.message || 'Quiz generation failed')
    } finally {
      setQuizLoading(false)
    }
  }

  async function gradeTextAnswer() {
    const q = gradeQ.trim()
    const a = gradeA.trim()
    if (!q || !a) return
    setError(null)
    setGradeLoading(true)
    setGradeResult(null)
    try {
      const res = await apiFetch<GradeResponse>('/ai/grade', {
        method: 'POST',
        body: JSON.stringify({
          question: q,
          student_answer: a,
          rubric: gradeRubric || null,
          max_marks: 10,
        }),
      })
      setGradeResult(res)
    } catch (e) {
      setError((e as { message?: string })?.message || 'Grading failed')
    } finally {
      setGradeLoading(false)
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

                    {isStudent ? (
                      <div className="flex items-center justify-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          type="button"
                          onClick={() => {
                            setAiForAssignment(a)
                            setAiAttempt('')
                            setAiWantFinal(false)
                            setAiResult(null)
                          }}
                        >
                          Ask AI
                        </Button>
                      </div>
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
          {isFaculty ? (
            <Card className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">AI Tools (Faculty)</div>
              <div className="text-xs text-slate-600">
                Upload notes and index them so the AI Tutor can answer based on your class materials.
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                {notesUrl ? (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
                    <span className="flex-1 truncate text-xs text-green-700">✅ Notes uploaded</span>
                    <a href={notesUrl} target="_blank" rel="noreferrer" className="text-xs text-slate-600 underline">
                      Preview
                    </a>
                    <button
                      onClick={() => setNotesUrl(null)}
                      className="text-xs text-red-500 hover:underline"
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <FileUpload
                    label="Upload notes (PDF)"
                    bucket="syllabi"
                    pathPrefix={`notes/${classroomId}`}
                    onUploaded={(url) => setNotesUrl(url)}
                  />
                )}

                <Button
                  loading={indexing}
                  disabled={!notesUrl}
                  onClick={() => notesUrl && indexNotes('notes', 'Class notes', notesUrl)}
                  type="button"
                >
                  Index for AI Tutor
                </Button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Summarize text</div>
                <textarea
                  className="min-h-[110px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="Paste notes / long answer here…"
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                />
                <Button loading={summaryLoading} onClick={summarizeNow} type="button" variant="secondary">
                  Summarize
                </Button>
                {summaryResult ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <div className="text-xs font-semibold text-slate-900">Summary</div>
                    <div className="text-sm text-slate-800 whitespace-pre-wrap">{summaryResult.answer}</div>
                    {summaryResult.steps?.length ? (
                      <ul className="list-disc pl-5 text-sm text-slate-700">
                        {summaryResult.steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Generate quiz</div>
                <Input label="Topic" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} />
                <Button loading={quizLoading} onClick={generateQuiz} type="button" variant="secondary">
                  Generate
                </Button>
                {quizResult?.questions?.length ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                    <div className="text-xs font-semibold text-slate-900">Quiz</div>
                    {quizResult.questions.map((q: any, idx: number) => (
                      <div key={idx} className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900">
                          {idx + 1}. {q.q}
                        </div>
                        <ul className="list-disc pl-5 text-sm text-slate-700">
                          {(q.options || []).map((opt: string, oi: number) => (
                            <li key={oi}>
                              {opt}{' '}
                              {q.correct_index === oi ? (
                                <span className="text-xs font-semibold text-green-700">(answer)</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Auto-grade (text)</div>
                <Input
                  label="Question"
                  value={gradeQ}
                  onChange={(e) => setGradeQ(e.target.value)}
                  placeholder="Paste question here…"
                />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Student answer</label>
                  <textarea
                    className="min-h-[90px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="Paste student answer text…"
                    value={gradeA}
                    onChange={(e) => setGradeA(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Rubric (optional)</label>
                  <textarea
                    className="min-h-[70px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="Key points expected, marking scheme, etc."
                    value={gradeRubric}
                    onChange={(e) => setGradeRubric(e.target.value)}
                  />
                </div>
                <Button loading={gradeLoading} onClick={gradeTextAnswer} type="button" variant="secondary">
                  Grade (out of 10)
                </Button>

                {gradeResult ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-900">Result</div>
                      <div className="text-xs font-semibold text-slate-700">{gradeResult.marks} / 10</div>
                    </div>
                    <div className="text-sm text-slate-800 whitespace-pre-wrap">{gradeResult.answer}</div>
                    {gradeResult.steps?.length ? (
                      <ul className="list-disc pl-5 text-sm text-slate-700">
                        {gradeResult.steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          <AiTutorPanel classroomId={classroomId} />
          <ChatPanel classroomId={classroomId} />
        </div>
      </div>

      {/* AI Assignment Helper modal */}
      {aiForAssignment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Ask AI: {aiForAssignment.title}</div>
                <div className="text-xs text-slate-500">
                  It will guide you with hints. Enable final answer only if you want it.
                </div>
              </div>
              <button
                className="rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
                onClick={() => setAiForAssignment(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700">Your attempt (optional)</div>
              <textarea
                className="min-h-[110px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Type what you tried so far…"
                value={aiAttempt}
                onChange={(e) => setAiAttempt(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={aiWantFinal}
                  onChange={(e) => setAiWantFinal(e.target.checked)}
                />
                Allow final answer
              </label>
              <div className="flex justify-end">
                <Button loading={aiLoading} onClick={askAiForAssignment} type="button">
                  Ask
                </Button>
              </div>
            </div>

            {aiResult ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="text-sm font-semibold text-slate-900">AI Help</div>
                <div className="text-sm text-slate-800 whitespace-pre-wrap">{aiResult.answer}</div>
                {aiResult.steps?.length ? (
                  <ul className="list-disc pl-5 text-sm text-slate-700">
                    {aiResult.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                ) : null}
                {aiResult.tips?.length ? (
                  <div className="text-sm text-slate-700">
                    <div className="text-xs font-semibold text-slate-900">Tips</div>
                    <ul className="list-disc pl-5">
                      {aiResult.tips.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

