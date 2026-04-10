import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
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

type Tab = 'assignments' | 'ai-tutor' | 'chat' | 'ai-tools'

// ─── inline helpers ───────────────────────────────────────────────────────────

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

const inputStyle: React.CSSProperties = {
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
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: '90px',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClassroomPage() {
  const { id } = useParams()
  const classroomId = id || ''
  const { profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('assignments')

  const effectiveRole = profile?.role || null
  const isFaculty = effectiveRole === 'faculty'
  const isStudent = effectiveRole === 'student'

  // Assignment creation state
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [newMaxMarks, setNewMaxMarks] = useState('')
  const [newFileUrl, setNewFileUrl] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Evaluation
  const [evaluatingSubmission, setEvaluatingSubmission] = useState<string | null>(null)
  const [evaluationResults, setEvaluationResults] = useState<Record<string, string>>({})
  const [submissionsByAssignment, setSubmissionsByAssignment] = useState<Record<string, Submission[]>>({})
  const [loadingSubmissionsFor, setLoadingSubmissionsFor] = useState<string | null>(null)
  const [mySubmissions, setMySubmissions] = useState<Record<string, Submission | null>>({})

  // AI assignment helper
  const [aiForAssignment, setAiForAssignment] = useState<Assignment | null>(null)
  const [aiAttempt, setAiAttempt] = useState('')
  const [aiWantFinal, setAiWantFinal] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AssignmentHelpResponse | null>(null)

  // Faculty AI tools
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
      setNewTitle(''); setNewDesc(''); setNewDeadline(''); setNewMaxMarks(''); setNewFileUrl(null)
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
    setError(null); setAiLoading(true); setAiResult(null)
    try {
      const qParts = [aiForAssignment.title, aiForAssignment.description || ''].filter(Boolean)
      const res = await apiFetch<AssignmentHelpResponse>('/ai/assignment-help', {
        method: 'POST',
        body: JSON.stringify({ question: qParts.join('\n\n'), attempt: aiAttempt || null, want_final: aiWantFinal }),
      })
      setAiResult(res)
    } catch (e) {
      setError((e as { message?: string })?.message || 'AI help failed')
    } finally {
      setAiLoading(false)
    }
  }

  async function indexNotes(kind: 'syllabus' | 'notes', title: string, url: string) {
    setError(null); setIndexing(true)
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
    setError(null); setSummaryLoading(true); setSummaryResult(null)
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
    setError(null); setQuizLoading(true); setQuizResult(null)
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
    const q = gradeQ.trim(); const a = gradeA.trim()
    if (!q || !a) return
    setError(null); setGradeLoading(true); setGradeResult(null)
    try {
      const res = await apiFetch<GradeResponse>('/ai/grade', {
        method: 'POST',
        body: JSON.stringify({ question: q, student_answer: a, rubric: gradeRubric || null, max_marks: 10 }),
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

  // Tab definitions — AI Tutor visible to everyone (students ask doubts, faculty also)
  const tabs: { id: Tab; label: string; icon: string; show?: boolean }[] = [
    { id: 'assignments', label: 'Assignments', icon: '📋' },
    { id: 'ai-tutor', label: isStudent ? 'Ask AI Tutor' : 'AI Tutor', icon: '✦' },
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'ai-tools', label: 'AI Tools', icon: '⚙️', show: isFaculty },
  ].filter(t => t.show !== false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <SectionHeader
        title={classroom.course_name}
        subtitle={classroom.description || 'No description'}
        right={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge variant="indigo">{classroom.course_code}</Badge>
            <Badge>Code: {classroom.class_code}</Badge>
            {classroom.syllabus_url ? (
              <a
                href={classroom.syllabus_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '5px 12px',
                  textDecoration: 'none',
                }}
              >
                📄 Syllabus
              </a>
            ) : null}
          </div>
        }
      />

      {/* Back link */}
      <div>
        <Link
          to={isStudent ? '/student' : '/faculty'}
          style={{ fontSize: '0.8rem', color: '#6366f1', textDecoration: 'none' }}
        >
          ← Back to dashboard
        </Link>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: '4px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        padding: '4px',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '9px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              ...(activeTab === tab.id
                ? {
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.2))',
                    color: '#a5b4fc',
                    boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.3)',
                  }
                : {
                    background: 'transparent',
                    color: '#64748b',
                  }),
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* ══ ASSIGNMENTS TAB ══ */}
        {activeTab === 'assignments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Student AI Tutor Info Banner */}
            {isStudent && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.07))',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: '14px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}>
                <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>✦</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#a5b4fc', marginBottom: '2px' }}>
                    Got a doubt? Ask the AI Tutor
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                    Your faculty has uploaded class materials. The AI Tutor can answer your questions based on those notes and syllabus — anytime, instantly.
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('ai-tutor')}
                  style={{
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '8px 16px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Ask Now →
                </button>
              </div>
            )}

            {/* Create Assignment (Faculty) */}
            {isFaculty && (
              <div style={cardStyle}>
                <div style={sectionLabel}>Create Assignment</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Input label="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                      Description / Evaluation Guidance
                      <span style={{ color: '#475569', marginLeft: '4px' }}>(used by AI to grade)</span>
                    </label>
                    <textarea
                      style={textareaStyle}
                      placeholder="Describe what students should cover, key concepts, examples…"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Input label="Max Marks" type="number" value={newMaxMarks} onChange={(e) => setNewMaxMarks(e.target.value)} placeholder="e.g. 100" />
                    <Input label="Deadline (optional)" type="datetime-local" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                      Question Paper / Reference File
                      <span style={{ color: '#475569', marginLeft: '4px' }}>(optional)</span>
                    </label>
                    {newFileUrl ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                        borderRadius: '10px', padding: '8px 12px',
                      }}>
                        <span style={{ flex: 1, fontSize: '0.8rem', color: '#4ade80' }}>✅ File uploaded</span>
                        <a href={newFileUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Preview</a>
                        <button onClick={() => setNewFileUrl(null)} style={{ fontSize: '0.8rem', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                      </div>
                    ) : (
                      <FileUpload label="Upload question file" bucket="assignments" pathPrefix={`questions/${classroomId}`} onUploaded={(url) => setNewFileUrl(url)} />
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button loading={creating} onClick={createAssignment} type="button">
                      + Create Assignment
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Assignment List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {assignments.length === 0 ? (
                <EmptyState title="No assignments yet" subtitle="When faculty posts assignments, they'll show up here." />
              ) : (
                assignments.map((a) => {
                  const isPastDeadline = a.deadline ? new Date() > new Date(a.deadline) : false
                  const mySub = mySubmissions[a.id]
                  return (
                    <div key={a.id} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* Title row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#e2e8f0' }}>{a.title}</div>
                          {a.description ? (
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>{a.description}</div>
                          ) : null}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                          {a.max_marks ? <Badge>{a.max_marks} marks</Badge> : null}
                          {a.file_url ? (
                            <a
                              href={a.file_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: '0.78rem',
                                color: '#94a3b8',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                padding: '4px 10px',
                                textDecoration: 'none',
                              }}
                            >
                              📄 Paper
                            </a>
                          ) : null}
                        </div>
                      </div>

                      {a.deadline ? (
                        <div style={{ fontSize: '0.78rem', color: isPastDeadline ? '#f87171' : '#64748b' }}>
                          {isPastDeadline ? '⛔' : '⏰'} Deadline: {new Date(a.deadline).toLocaleString()}
                        </div>
                      ) : null}

                      {/* Student actions */}
                      {isStudent ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {isPastDeadline ? (
                            <div style={{
                              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                              borderRadius: '10px', padding: '8px 12px',
                              fontSize: '0.82rem', color: '#fca5a5',
                            }}>
                              ⛔ Deadline has passed. Submissions are closed.
                            </div>
                          ) : (
                            <div style={{
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              borderRadius: '12px', padding: '12px',
                            }}>
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
                                    const sub = await apiFetch<Submission | null>(`/assignments/${a.id}/my-submission`)
                                    setMySubmissions((prev) => ({ ...prev, [a.id]: sub }))
                                  } catch (e) {
                                    setError((e as { message?: string })?.message || 'Submission failed')
                                  }
                                }}
                              />
                            </div>
                          )}

                          {mySub ? (
                            <div style={{
                              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                              borderRadius: '10px', padding: '8px 12px',
                              fontSize: '0.82rem', color: '#4ade80',
                            }}>
                              ✅ Submitted on {new Date(mySub.submitted_at).toLocaleString()}
                            </div>
                          ) : null}

                          {mySub?.evaluation_feedback ? (
                            <div style={{
                              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                              borderRadius: '12px', padding: '14px',
                            }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                                📋 Your Result
                              </div>
                              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: '#cbd5e1', fontFamily: 'inherit', margin: 0 }}>
                                {mySub.evaluation_feedback}
                              </pre>
                            </div>
                          ) : null}

                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              onClick={() => setActiveTab('ai-tutor')}
                              style={{ fontSize: '0.78rem' }}
                            >
                              ✦ Ask AI Tutor
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              onClick={() => { setAiForAssignment(a); setAiAttempt(''); setAiWantFinal(false); setAiResult(null) }}
                              style={{ fontSize: '0.78rem' }}
                            >
                              🎯 Assignment Help
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {/* Faculty submission view */}
                      {isFaculty ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Student Submissions</span>
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

                          {submissionsByAssignment[a.id] ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {submissionsByAssignment[a.id].length === 0 ? (
                                <div style={{ fontSize: '0.85rem', color: '#475569' }}>No submissions yet.</div>
                              ) : (
                                submissionsByAssignment[a.id].map((s) => (
                                  <div
                                    key={s.id}
                                    style={{
                                      background: 'rgba(255,255,255,0.03)',
                                      border: '1px solid rgba(255,255,255,0.06)',
                                      borderRadius: '10px', padding: '10px 12px',
                                      display: 'flex', flexDirection: 'column', gap: '8px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                        {s.student_id} · {new Date(s.submitted_at).toLocaleString()}
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <a
                                          href={s.file_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{ fontSize: '0.82rem', color: '#818cf8', textDecoration: 'none' }}
                                        >
                                          ↓ Download
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
                                      <div style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: '8px', padding: '10px',
                                        fontSize: '0.82rem', color: '#94a3b8',
                                        whiteSpace: 'pre-wrap',
                                      }}>
                                        <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>AI Evaluation</div>
                                        {evaluationResults[s.id] || s.evaluation_feedback}
                                      </div>
                                    ) : null}
                                  </div>
                                ))
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ══ AI TUTOR TAB ══ */}
        {activeTab === 'ai-tutor' && (
          <div style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
            <AiTutorPanel classroomId={classroomId} />
          </div>
        )}

        {/* ══ CHAT TAB ══ */}
        {activeTab === 'chat' && (
          <div style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
            <ChatPanel classroomId={classroomId} />
          </div>
        )}

        {/* ══ AI TOOLS TAB (Faculty) ══ */}
        {activeTab === 'ai-tools' && isFaculty && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Upload & index notes */}
            <div style={cardStyle}>
              <div style={sectionLabel}>📁 Upload & Index Notes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                  Upload notes and index them so the AI Tutor can answer based on your class materials.
                </p>
                {notesUrl ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                    borderRadius: '10px', padding: '8px 12px',
                  }}>
                    <span style={{ flex: 1, fontSize: '0.82rem', color: '#4ade80' }}>✅ Notes uploaded</span>
                    <a href={notesUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Preview</a>
                    <button onClick={() => setNotesUrl(null)} style={{ fontSize: '0.8rem', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                  </div>
                ) : (
                  <FileUpload label="Upload notes (PDF)" bucket="syllabi" pathPrefix={`notes/${classroomId}`} onUploaded={(url) => setNotesUrl(url)} />
                )}
                <div>
                  <Button loading={indexing} disabled={!notesUrl} onClick={() => notesUrl && indexNotes('notes', 'Class notes', notesUrl)} type="button">
                    Index for AI Tutor
                  </Button>
                </div>
              </div>
            </div>

            {/* Summarize */}
            <div style={cardStyle}>
              <div style={sectionLabel}>📝 Summarize Text</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <textarea
                  style={textareaStyle}
                  placeholder="Paste notes / long answer here…"
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                />
                <div>
                  <Button loading={summaryLoading} onClick={summarizeNow} type="button" variant="secondary">
                    Summarize
                  </Button>
                </div>
                {summaryResult ? (
                  <div style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '12px', padding: '14px',
                  }}>
                    <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '8px', fontSize: '0.85rem' }}>Summary</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8', whiteSpace: 'pre-wrap' }}>{summaryResult.answer}</div>
                    {summaryResult.steps?.length ? (
                      <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '0.85rem', color: '#64748b' }}>
                        {summaryResult.steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Generate quiz */}
            <div style={cardStyle}>
              <div style={sectionLabel}>❓ Generate Quiz</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Input label="Topic" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} />
                <div>
                  <Button loading={quizLoading} onClick={generateQuiz} type="button" variant="secondary">
                    Generate
                  </Button>
                </div>
                {quizResult?.questions?.length ? (
                  <div style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '12px', padding: '14px',
                    display: 'flex', flexDirection: 'column', gap: '12px',
                  }}>
                    {quizResult.questions.map((q: any, idx: number) => (
                      <div key={idx}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#e2e8f0', marginBottom: '4px' }}>
                          {idx + 1}. {q.q}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#64748b' }}>
                          {(q.options || []).map((opt: string, oi: number) => (
                            <li key={oi} style={{ color: q.correct_index === oi ? '#4ade80' : '#64748b' }}>
                              {opt} {q.correct_index === oi ? '✓' : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Auto-grade */}
            <div style={cardStyle}>
              <div style={sectionLabel}>🎯 Auto-Grade (Text Answer)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Input label="Question" value={gradeQ} onChange={(e) => setGradeQ(e.target.value)} placeholder="Paste question here…" />
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Student Answer</label>
                  <textarea style={textareaStyle} placeholder="Paste student answer text…" value={gradeA} onChange={(e) => setGradeA(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Rubric (optional)</label>
                  <textarea style={{ ...textareaStyle, minHeight: '70px' }} placeholder="Key points expected, marking scheme…" value={gradeRubric} onChange={(e) => setGradeRubric(e.target.value)} />
                </div>
                <div>
                  <Button loading={gradeLoading} onClick={gradeTextAnswer} type="button" variant="secondary">
                    Grade (out of 10)
                  </Button>
                </div>
                {gradeResult ? (
                  <div style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '12px', padding: '14px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#e2e8f0' }}>Result</span>
                      <span style={{
                        fontSize: '1rem', fontWeight: 700,
                        background: 'linear-gradient(135deg, #818cf8, #c084fc)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                      }}>{gradeResult.marks} / 10</span>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8', whiteSpace: 'pre-wrap' }}>{gradeResult.answer}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Assignment Helper Modal */}
      {aiForAssignment ? (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          padding: '16px',
        }}>
          <div style={{
            width: '100%', maxWidth: '600px',
            background: '#1a1d27',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            padding: '24px',
            display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 25px 80px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#e2e8f0' }}>
                  ✦ Ask AI: {aiForAssignment.title}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                  It will guide you with hints. Enable final answer only if you want it.
                </div>
              </div>
              <button
                onClick={() => setAiForAssignment(null)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '6px 12px',
                  color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit',
                  flexShrink: 0,
                }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                  Your attempt (optional)
                </label>
                <textarea
                  style={textareaStyle}
                  placeholder="Type what you tried so far…"
                  value={aiAttempt}
                  onChange={(e) => setAiAttempt(e.target.value)}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={aiWantFinal}
                  onChange={(e) => setAiWantFinal(e.target.checked)}
                  style={{ accentColor: '#6366f1' }}
                />
                Allow final answer
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button loading={aiLoading} onClick={askAiForAssignment} type="button">
                  Ask AI
                </Button>
              </div>
            </div>

            {aiResult ? (
              <div style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: '14px', padding: '16px',
                display: 'flex', flexDirection: 'column', gap: '10px',
                maxHeight: '300px', overflowY: 'auto',
              }}>
                <div style={{ fontWeight: 600, color: '#a5b4fc', fontSize: '0.85rem' }}>AI Help</div>
                <div style={{ fontSize: '0.875rem', color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>{aiResult.answer}</div>
                {aiResult.steps?.length ? (
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#64748b' }}>
                    {aiResult.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                ) : null}
                {aiResult.tips?.length ? (
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>Tips</div>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#64748b' }}>
                      {aiResult.tips.map((t, i) => <li key={i}>{t}</li>)}
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
