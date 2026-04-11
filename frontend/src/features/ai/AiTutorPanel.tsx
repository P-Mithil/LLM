import { useEffect, useRef, useState } from 'react'

import { ErrorBanner } from '../../components/ErrorBanner'
import { Loading } from '../../components/Loading'
import { apiFetch } from '../../lib/api'

type AiChatResponse = {
  answer: string
  steps: string[]
  tips: string[]
  related_topics?: string[]
  sources?: { chunk_id?: string; title?: string; source_url?: string }[]
}

type Turn = {
  role: 'user' | 'assistant'
  text: string
}

const suggestedQuestions = [
  'Summarize the key topics from the class material',
  'What are the important concepts I should know?',
  'Explain this topic in simple terms',
  'Give me practice questions on this subject',
]

export function AiTutorPanel({ classroomId }: { classroomId: string }) {
  const [history, setHistory] = useState<Turn[]>([])
  const [text, setText] = useState('')
  const [mode, setMode] = useState('Detailed')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [history.length, loading])

  async function ask(question?: string, actionName?: string) {
    const q = (question ?? text).trim()
    if (!q) return
    setError(null)
    setLoading(true)
    const act = actionName || 'Ask'
    setHistory((prev) => [...prev, { role: 'user', text: act === 'Ask' ? q : `[${act}] ${q}` }])
    setText('')

    try {
      const res = await apiFetch<AiChatResponse>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ classroom_id: classroomId, question: q, mode, action: act }),
      })

      const parts: string[] = []
      if (res.answer) parts.push(res.answer)
      if (res.steps?.length) parts.push(`Steps:\n- ${res.steps.join('\n- ')}`)
      if (res.tips?.length) parts.push(`Tips:\n- ${res.tips.join('\n- ')}`)
      
      let finalResponse = parts.join('\n\n') || 'No response.'
      
      const metaParts: string[] = []
      if (res.sources?.length) {
        metaParts.push(`📄 Source:\n${res.sources.map(s => `- ${s.title || 'Material'}`).join('\n')}`)
      }
      if (res.related_topics?.length) {
        metaParts.push(`💡 Related Topics:\n${res.related_topics.map(t => `- ${t}`).join('\n')}`)
      }

      if (metaParts.length > 0) {
        finalResponse += '\n\n--------------------------------\n' + metaParts.join('\n\n') + '\n--------------------------------'
      }

      setHistory((prev) => [
        ...prev,
        { role: 'assistant', text: finalResponse },
      ])
    } catch (e) {
      setError((e as { message?: string })?.message || 'AI chat failed')
    } finally {
      setLoading(false)
    }
  }

  const showWelcome = history.length === 0 && !loading

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
        background: 'rgba(99,102,241,0.05)',
      }}>
        <span style={{ fontSize: '1.1rem' }}>✦</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#e2e8f0' }}>AI Tutor</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
            Answers based on your class materials uploaded by faculty
          </div>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setHistory([])}
            style={{
              fontSize: '0.75rem',
              color: '#475569',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {error ? <div style={{ padding: '8px 18px', flexShrink: 0 }}><ErrorBanner message={error} /></div> : null}

      {/* Chat area */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minHeight: 0,
        }}
      >
        {/* Welcome screen with suggested questions */}
        {showWelcome && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✦</div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#a5b4fc', marginBottom: '4px' }}>
                AI Tutor — Ask your doubts here
              </div>
              <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                Ask anything about your class topics. If your faculty has uploaded notes or syllabus,
                the AI will answer using those materials.
              </div>
            </div>

            {/* Suggested questions */}
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Try asking…
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => ask(q)}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '0.85rem',
                      color: '#94a3b8',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.1)'
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.3)'
                      ;(e.currentTarget as HTMLButtonElement).style.color = '#a5b4fc'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'
                      ;(e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'
                    }}
                  >
                    <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>↗</span>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat history */}
        {history.map((t, idx) => (
          <div key={idx} style={{
            display: 'flex',
            justifyContent: t.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: t.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              ...(t.role === 'user'
                ? {
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff',
                    boxShadow: '0 0 16px rgba(99,102,241,0.2)',
                  }
                : {
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#cbd5e1',
                  }),
            }}>
              {t.role === 'assistant' && (
                <div style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 600, marginBottom: '4px', letterSpacing: '0.05em' }}>
                  ✦ AI TUTOR
                </div>
              )}
              {t.text}
            </div>
          </div>
        ))}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '14px 14px 14px 4px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <Loading label="AI is thinking…" />
            </div>
          </div>
        ) : null}
      </div>

      {/* Input and Controls Area */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontWeight: 600, color: '#e2e8f0' }}>Mode:</div>
          {['Beginner', 'Exam', 'Detailed'].map(m => (
            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={mode === m}
                onChange={() => setMode(m)}
                style={{ accentColor: '#6366f1' }}
              />
              {m}
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask your doubt about class material…"
            onKeyDown={(e) => { if (e.key === 'Enter') ask() }}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '0.875rem',
              color: '#e2e8f0',
              outline: 'none',
              fontFamily: 'inherit',
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(129,140,248,0.6)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['Ask', 'Explain Simply', 'More Examples', 'Practice Questions', 'Summarize'].map(act => (
            <button
              key={act}
              onClick={() => ask(text, act)}
              disabled={loading || !text.trim()}
              style={{
                padding: '8px 14px',
                background: act === 'Ask' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.08)',
                color: act === 'Ask' ? '#fff' : '#e2e8f0',
                border: act === 'Ask' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: loading || !text.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !text.trim() ? 0.5 : 1,
                transition: 'all 0.2s',
                fontFamily: 'inherit',
              }}
            >
              {act === 'Ask' ? `${act} ✦` : act}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
