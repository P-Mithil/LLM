import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { Input } from '../components/Input'
import { Loading } from '../components/Loading'
import { FileUpload } from '../components/FileUpload'
import { SectionHeader } from '../components/SectionHeader'
import { LeaderboardVisual } from '../components/LeaderboardVisual'
import { useAuth } from '../app/AuthContext'
import type { Classroom } from '../features/classrooms/types'
import { ChatPanel } from '../features/chat/ChatPanel'
import { AiTutorPanel } from '../features/ai/AiTutorPanel'
import { apiFetch } from '../lib/api'
import { uploadPublicFile } from '../lib/storage'

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

type Tab = 'announcements' | 'assignments' | 'leaderboard' | 'ai-tutor' | 'chat' | 'ai-tools'

type Announcement = {
  id: string
  classroom_id: string
  author_id: string
  author_name?: string
  author_role?: string
  body: string
  file_url?: string | null
  file_name?: string | null
  created_at: string
}

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

function LeaderboardRenderer({ dataStr }: { dataStr: string }) {
  try {
    const raw = dataStr.replace(/^```json/i, '').replace(/```$/i, '').trim()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0 && ('rank' in parsed[0] || 'name' in parsed[0])) {
      return <LeaderboardVisual data={parsed} />
    }
  } catch (e) {
    // Ignore: Not JSON, fallback to markdown
  }

  return (
    <div className="leaderboard-prose" style={{ width: '100%' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({node, ...props}) => <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', marginBottom: '24px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflow: 'hidden' }} {...props} />,
          thead: ({node, ...props}) => <thead style={{ background: 'rgba(234,179,8,0.1)', borderBottom: '2px solid rgba(234,179,8,0.2)' }} {...props} />,
          th: ({node, ...props}) => <th style={{ padding: '14px 16px', textAlign: 'left', color: '#fde047', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }} {...props} />,
          tbody: ({node, ...props}) => <tbody style={{  }} {...props} />,
          tr: ({node, ...props}) => <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} {...props} />,
          td: ({node, ...props}) => <td style={{ padding: '14px 16px', color: '#f8fafc', fontSize: '0.9rem' }} {...props} />,
          h2: ({node, ...props}) => <h2 style={{ fontSize: '1.25rem', color: '#f8fafc', marginTop: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }} {...props} />,
          p: ({node, ...props}) => <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '12px', whiteSpace: 'pre-wrap' }} {...props} />,
          ul: ({node, ...props}) => <ul style={{ paddingLeft: '24px', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px', listStyleType: 'disc' }} {...props} />,
          li: ({node, ...props}) => <li style={{ marginBottom: '8px' }} {...props} />,
          hr: ({node, ...props}) => <hr style={{ border: 'none', borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '24px 0' }} {...props} />,
          strong: ({node, ...props}) => <strong style={{ color: '#e2e8f0', fontWeight: 600 }} {...props} />
        }}
      >
        {dataStr}
      </ReactMarkdown>
    </div>
  )
}

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

  // Per-assignment inline submission state
  const [submitFiles, setSubmitFiles] = useState<Record<string, File | null>>({})
  const [submitLoading, setSubmitLoading] = useState<Record<string, boolean>>({})
  const [showResubmit, setShowResubmit] = useState<Record<string, boolean>>({})

  // Course Leaderboard state
  const [courseLeaderboard, setCourseLeaderboard] = useState<string | null>(null)
  const [generatingCourseLeaderboard, setGeneratingCourseLeaderboard] = useState<boolean>(false)

  // Assignment Leaderboard state
  const [generatingAssignmentLeaderboardFor, setGeneratingAssignmentLeaderboardFor] = useState<string | null>(null)
  const [assignmentLeaderboards, setAssignmentLeaderboards] = useState<Record<string, string>>({})

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [announcementsLoaded, setAnnouncementsLoaded] = useState(false)
  const [announcementBody, setAnnouncementBody] = useState('')
  const [annFileUrl, setAnnFileUrl] = useState<string | null>(null)
  const [annFileName, setAnnFileName] = useState<string | null>(null)
  const [annAttaching, setAnnAttaching] = useState(false)
  const annFileInputRef = useRef<HTMLInputElement>(null)
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)

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
      
      a.forEach(assignment => loadAssignmentLeaderboard(assignment.id))
    } catch (e) {
      setError((e as { message?: string })?.message || 'Failed to load classroom')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!classroomId) return
    load()
    loadCourseLeaderboard()
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

  async function loadCourseLeaderboard() {
    try {
      const res = await apiFetch<{ leaderboard: string }>(`/classrooms/${classroomId}/leaderboard`)
      setCourseLeaderboard(res.leaderboard || null)
    } catch {
      // Ignore errors for uninitialized leaderboards
    }
  }

  async function generateCourseLeaderboard() {
    setGeneratingCourseLeaderboard(true)
    setError(null)
    try {
      const res = await apiFetch<{ leaderboard: string }>(`/classrooms/${classroomId}/leaderboard/generate`, {
        method: 'POST',
      })
      setCourseLeaderboard(res.leaderboard)
      setActiveTab('leaderboard')
    } catch (e) {
      setError((e as { message?: string })?.message || 'Failed to generate cumulative leaderboard')
    } finally {
      setGeneratingCourseLeaderboard(false)
    }
  }

  async function loadAssignmentLeaderboard(assignmentId: string) {
    try {
      const res = await apiFetch<{ leaderboard: string }>(`/assignments/${assignmentId}/leaderboard`)
      if (res.leaderboard) setAssignmentLeaderboards(prev => ({ ...prev, [assignmentId]: res.leaderboard }))
    } catch {
      // Ignore errors for uninitialized leaderboards
    }
  }

  async function generateAssignmentLeaderboard(assignmentId: string) {
    setError(null)
    setGeneratingAssignmentLeaderboardFor(assignmentId)
    try {
      const res = await apiFetch<{ leaderboard: string }>(`/assignments/${assignmentId}/leaderboard/generate`, {
        method: 'POST',
      })
      setAssignmentLeaderboards(prev => ({ ...prev, [assignmentId]: res.leaderboard }))
    } catch (e) {
      setError((e as { message?: string })?.message || 'Failed to generate assignment leaderboard')
    } finally {
      setGeneratingAssignmentLeaderboardFor(null)
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

  async function handleSubmitFile(assignmentId: string, file: File) {
    setSubmitLoading((prev) => ({ ...prev, [assignmentId]: true }))
    setError(null)
    try {
      const safeName = file.name.replaceAll(' ', '_')
      const path = `submissions/${assignmentId}/${crypto.randomUUID()}-${safeName}`
      const url = await uploadPublicFile({ bucket: 'submissions', path, file })
      await apiFetch(`/assignments/${assignmentId}/submissions`, {
        method: 'POST',
        body: JSON.stringify({ file_url: url }),
      })
      const sub = await apiFetch<Submission | null>(`/assignments/${assignmentId}/my-submission`)
      setMySubmissions((prev) => ({ ...prev, [assignmentId]: sub }))
      setSubmitFiles((prev) => ({ ...prev, [assignmentId]: null }))
      setShowResubmit((prev) => ({ ...prev, [assignmentId]: false }))
    } catch (e) {
      setError((e as { message?: string })?.message || 'Submission failed')
    } finally {
      setSubmitLoading((prev) => ({ ...prev, [assignmentId]: false }))
    }
  }

  async function loadAnnouncements() {
    try {
      const rows = await apiFetch<Announcement[]>(`/classrooms/${classroomId}/announcements`)
      setAnnouncements(rows)
    } catch {
      // endpoint may not exist yet — silently ignore
    } finally {
      setAnnouncementsLoaded(true)
    }
  }

  async function attachAnnFile(file: File) {
    setAnnAttaching(true)
    try {
      const safeName = file.name.replaceAll(' ', '_')
      const path = `announcements/${classroomId}/${crypto.randomUUID()}-${safeName}`
      const url = await uploadPublicFile({ bucket: 'assignments', path, file })
      setAnnFileUrl(url)
      setAnnFileName(file.name)
    } catch (e) {
      setError((e as { message?: string })?.message || 'File upload failed')
    } finally {
      setAnnAttaching(false)
    }
  }

  async function postAnnouncement() {
    if (!announcementBody.trim() && !annFileUrl) return
    setPostingAnnouncement(true)
    try {
      const created = await apiFetch<Announcement>(`/classrooms/${classroomId}/announcements`, {
        method: 'POST',
        body: JSON.stringify({
          body: announcementBody.trim(),
          file_url: annFileUrl || null,
          file_name: annFileName || null,
        }),
      })
      setAnnouncements((prev) => [created, ...prev])
      setAnnouncementBody('')
      setAnnFileUrl(null)
      setAnnFileName(null)
    } catch (e) {
      setError((e as { message?: string })?.message || 'Failed to post announcement')
    } finally {
      setPostingAnnouncement(false)
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorBanner message={error} />
  if (!classroom) return <ErrorBanner message="Classroom not found." />

  // Tab definitions — AI Tutor visible to everyone (students ask doubts, faculty also)
  const tabs: { id: Tab; label: string; icon: string; show?: boolean }[] = [
    { id: 'announcements', label: 'Announcements', icon: '📢' },
    { id: 'assignments', label: 'Assignments', icon: '📋' },
    { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
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
            onClick={() => {
              setActiveTab(tab.id)
              if (tab.id === 'announcements' && !announcementsLoaded) loadAnnouncements()
            }}
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

        {/* ══ ANNOUNCEMENTS TAB ══ */}
        {activeTab === 'announcements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Composer: faculty AND students can post */}
            {(isFaculty || isStudent) && (
              <div style={cardStyle}>
                <div style={sectionLabel}>
                  {isFaculty ? '📢 New Announcement' : '✏️ Share with the Class'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <textarea
                    style={{
                      ...textareaStyle,
                      minHeight: '100px',
                      fontSize: '0.9rem',
                      borderColor: isStudent ? 'rgba(20,184,166,0.3)' : undefined,
                    }}
                    placeholder={
                      isFaculty
                        ? 'Share something with the class — updates, reminders, resources…'
                        : 'Ask a question, share a resource, or post a note for everyone…'
                    }
                    value={announcementBody}
                    onChange={(e) => setAnnouncementBody(e.target.value)}
                  />
                  {/* Attached file preview */}
                  {annFileUrl && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                      borderRadius: '10px', padding: '8px 12px',
                    }}>
                      <span style={{ fontSize: '1rem' }}>📎</span>
                      <span style={{ flex: 1, fontSize: '0.8rem', color: '#4ade80', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {annFileName}
                      </span>
                      <button
                        onClick={() => { setAnnFileUrl(null); setAnnFileName(null) }}
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 }}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  )}

                  {/* Bottom toolbar: attach + post button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    {/* Hidden file input */}
                    <input
                      ref={annFileInputRef}
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) attachAnnFile(f); e.target.value = '' }}
                    />
                    <button
                      type="button"
                      disabled={annAttaching}
                      onClick={() => annFileInputRef.current?.click()}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: annAttaching ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px', padding: '7px 14px',
                        fontSize: '0.82rem', color: '#94a3b8',
                        cursor: annAttaching ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 0.2s',
                      }}
                    >
                      {annAttaching ? '⏳ Uploading…' : '📎 Attach file'}
                    </button>
                    <Button
                      loading={postingAnnouncement}
                      onClick={postAnnouncement}
                      type="button"
                      disabled={!announcementBody.trim() && !annFileUrl}
                    >
                      {isFaculty ? 'Post →' : 'Share →'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Announcement feed */}
            {!announcementsLoaded ? (
              <Loading />
            ) : announcements.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 20px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px',
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📢</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  No announcements yet
                </div>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                  {isFaculty
                    ? 'Post an announcement above to notify your students.'
                    : 'No messages yet. Be the first to share something!'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: '14px',
                      padding: '18px 20px',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Left accent bar — teal for students, indigo for faculty */}
                    <div style={{
                      position: 'absolute',
                      left: 0, top: 0, bottom: 0,
                      width: '4px',
                      background: ann.author_role === 'student'
                        ? 'linear-gradient(180deg, #14b8a6, #06b6d4)'
                        : 'linear-gradient(180deg, #6366f1, #8b5cf6)',
                      borderRadius: '14px 0 0 14px',
                    }} />
                    <div style={{ paddingLeft: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        {/* Avatar — teal for students */}
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '50%',
                          background: ann.author_role === 'student'
                            ? 'linear-gradient(135deg, #14b8a6, #06b6d4)'
                            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.85rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}>
                          {(ann.author_name ?? (ann.author_role === 'student' ? 'S' : 'F'))[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>
                              {ann.author_name ?? (ann.author_role === 'student' ? 'Student' : 'Faculty')}
                            </div>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '999px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              background: ann.author_role === 'student'
                                ? 'rgba(20,184,166,0.15)'
                                : 'rgba(99,102,241,0.15)',
                              color: ann.author_role === 'student' ? '#2dd4bf' : '#a5b4fc',
                            }}>
                              {ann.author_role === 'student' ? 'Student' : 'Faculty'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                            {new Date(ann.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {ann.body && (
                        <div style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                          {ann.body}
                        </div>
                      )}

                      {/* File attachment — prominent full-width card */}
                      {ann.file_url && (
                        <a
                          href={ann.file_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            marginTop: ann.body ? '14px' : '0',
                            background: ann.author_role === 'student'
                              ? 'rgba(20,184,166,0.08)'
                              : 'rgba(99,102,241,0.08)',
                            border: ann.author_role === 'student'
                              ? '1px solid rgba(20,184,166,0.25)'
                              : '1px solid rgba(99,102,241,0.25)',
                            borderRadius: '12px',
                            padding: '14px 16px',
                            textDecoration: 'none',
                            width: '100%',
                            boxSizing: 'border-box',
                            transition: 'background 0.2s',
                          }}
                        >
                          {/* File icon */}
                          <div style={{
                            width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                            background: ann.author_role === 'student'
                              ? 'rgba(20,184,166,0.18)'
                              : 'rgba(99,102,241,0.18)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.4rem',
                          }}>
                            📄
                          </div>
                          {/* File info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.88rem', fontWeight: 700,
                              color: ann.author_role === 'student' ? '#2dd4bf' : '#a5b4fc',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {ann.file_name || 'Attached file'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                              Click to open • attached by {ann.author_role === 'student' ? 'student' : 'faculty'}
                            </div>
                          </div>
                          {/* CTA */}
                          <div style={{
                            flexShrink: 0,
                            background: ann.author_role === 'student'
                              ? 'rgba(20,184,166,0.2)'
                              : 'rgba(99,102,241,0.2)',
                            color: ann.author_role === 'student' ? '#2dd4bf' : '#a5b4fc',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}>
                            Open ↗
                          </div>
                        </a>
                      )}

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                fontSize: '0.82rem',
                                color: '#a5b4fc',
                                background: 'rgba(99,102,241,0.12)',
                                border: '1px solid rgba(99,102,241,0.3)',
                                borderRadius: '8px',
                                padding: '5px 12px',
                                textDecoration: 'none',
                                fontWeight: 600,
                              }}
                            >
                              📄 View Paper
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
                          ) : (() => {
                            const chosenFile = submitFiles[a.id] || null
                            const isUploading = !!submitLoading[a.id]
                            return (
                              <div style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px dashed rgba(255,255,255,0.12)',
                                borderRadius: '14px',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                              }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                  {mySub ? '🔄 Replace Submission' : '📤 Submit Your Work'}
                                </div>

                                {/* File picker area */}
                                <label style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  background: chosenFile ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                                  border: chosenFile ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.08)',
                                  borderRadius: '10px',
                                  padding: '12px 14px',
                                  cursor: isUploading ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.2s',
                                }}>
                                  <input
                                    type="file"
                                    style={{ display: 'none' }}
                                    disabled={isUploading}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0] || null
                                      setSubmitFiles((prev) => ({ ...prev, [a.id]: f }))
                                      e.target.value = ''
                                    }}
                                  />
                                  <div style={{
                                    width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                                    background: chosenFile ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.1rem',
                                  }}>
                                    {chosenFile ? '📄' : '📁'}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    {chosenFile ? (
                                      <>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#a5b4fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {chosenFile.name}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                                          {(chosenFile.size / 1024).toFixed(1)} KB · click to change
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Click to choose a file</div>
                                        <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px' }}>PDF, image, doc, etc.</div>
                                      </>
                                    )}
                                  </div>
                                  {chosenFile && !isUploading && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.preventDefault(); setSubmitFiles((prev) => ({ ...prev, [a.id]: null })) }}
                                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0, padding: '4px' }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </label>

                                {/* Submit button */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                  {mySub && (
                                    <button
                                      type="button"
                                      onClick={() => setShowResubmit((prev) => ({ ...prev, [a.id]: false }))}
                                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}
                                    >
                                      ← Cancel
                                    </button>
                                  )}
                                  <Button
                                    loading={isUploading}
                                    disabled={!chosenFile}
                                    type="button"
                                    onClick={() => chosenFile && handleSubmitFile(a.id, chosenFile)}
                                    style={{ marginLeft: 'auto' }}
                                  >
                                    {isUploading ? 'Uploading…' : mySub ? '🔄 Re-submit' : '📤 Submit'}
                                  </Button>
                                </div>
                              </div>
                            )
                          })()}

                          {/* Submission status + re-submit CTA */}
                          {mySub && !showResubmit[a.id] ? (
                            <div style={{
                              background: 'rgba(34,197,94,0.06)',
                              border: '1px solid rgba(34,197,94,0.2)',
                              borderRadius: '12px',
                              padding: '12px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                            }}>
                              <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>✅</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4ade80' }}>Submitted</div>
                                <div style={{ fontSize: '0.72rem', color: '#86efac', marginTop: '2px' }}>
                                  {new Date(mySub.submitted_at).toLocaleString()}
                                </div>
                                <a
                                  href={mySub.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontSize: '0.72rem', color: '#6ee7b7', textDecoration: 'none', display: 'inline-block', marginTop: '4px' }}
                                >
                                  📄 View submitted file ↗
                                </a>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowResubmit((prev) => ({ ...prev, [a.id]: true }))}
                                style={{
                                  flexShrink: 0,
                                  background: 'rgba(34,197,94,0.15)',
                                  border: '1px solid rgba(34,197,94,0.3)',
                                  borderRadius: '8px',
                                  padding: '6px 14px',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  color: '#4ade80',
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                🔄 Replace
                              </button>
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
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={generatingAssignmentLeaderboardFor === a.id}
                                onClick={() => generateAssignmentLeaderboard(a.id)}
                                type="button"
                              >
                                {assignmentLeaderboards[a.id] ? 'Update Leaderboard' : 'Generate Leaderboard'}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={loadingSubmissionsFor === a.id}
                                onClick={() => loadSubmissions(a.id)}
                                type="button"
                              >
                                View Submissions
                              </Button>
                            </div>
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
                      
                      {/* Assignment Leaderboard display */}
                      {assignmentLeaderboards[a.id] ? (
                         <div style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(234,179,8,0.2)',
                          borderRadius: '12px',
                          padding: '16px',
                          marginTop: '8px',
                          boxShadow: 'inset 0 0 20px rgba(234,179,8,0.02)'
                        }}>
                          <LeaderboardRenderer dataStr={assignmentLeaderboards[a.id]} />
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ══ LEADERBOARD TAB ══ */}
        {activeTab === 'leaderboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={sectionLabel}>🏆 Cumulative Leaderboard</div>
                {isFaculty && (
                  <Button
                    loading={generatingCourseLeaderboard}
                    onClick={generateCourseLeaderboard}
                    type="button"
                  >
                     {courseLeaderboard ? 'Update Leaderboard' : 'Generate Leaderboard'}
                  </Button>
                )}
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Cumulative rankings and statistics compiled across all assignments in this course.
              </p>
              
              {courseLeaderboard ? (
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(234,179,8,0.2)',
                  borderRadius: '12px',
                  padding: '24px',
                  marginTop: '16px',
                  boxShadow: 'inset 0 0 40px rgba(234,179,8,0.02)'
                }}>
                  <LeaderboardRenderer dataStr={courseLeaderboard} />
                </div>
              ) : (
                <div style={{ marginTop: '20px' }}>
                  <EmptyState icon="🏆" message="No leaderboard generated for this course yet." />
                </div>
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
