import { useEffect, useRef, useState } from 'react'

import { ErrorBanner } from '../../components/ErrorBanner'
import { Loading } from '../../components/Loading'
import { apiFetch } from '../../lib/api'

type MessageRow = {
  id: string
  classroom_id: string
  sender_id: string
  sender_name: string
  message: string
  timestamp: string
}

export function ChatPanel({ classroomId }: { classroomId: string }) {
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const rows = await apiFetch<MessageRow[]>(`/classrooms/${classroomId}/messages?limit=50`)
      setMessages(rows)
    } catch (e) {
      setError((e as { message?: string })?.message || 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const intervalId = window.setInterval(load, 5000)
    return () => { window.clearInterval(intervalId) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  async function send() {
    const trimmed = text.trim()
    if (!trimmed) return
    setError(null)
    setSending(true)
    try {
      const row = await apiFetch<MessageRow>(`/classrooms/${classroomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: trimmed }),
      })
      setMessages((prev) => [...prev, row])
      setText('')
    } catch (e) {
      setError((e as { message?: string })?.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  function senderColor(name: string) {
    const colors = ['#818cf8', '#34d399', '#f472b6', '#fb923c', '#60a5fa', '#a78bfa', '#facc15']
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }

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
      }}>
        <span style={{ fontSize: '1rem' }}>💬</span>
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#e2e8f0' }}>Class Chat</span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '0.7rem',
          color: '#22c55e',
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: '9999px',
          padding: '2px 8px',
        }}>● Live</span>
      </div>

      {error ? <div style={{ padding: '8px 18px', flexShrink: 0 }}><ErrorBanner message={error} /></div> : null}

      {/* Messages List */}
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
        {loading && messages.length === 0 ? <Loading /> : null}

        {messages.length === 0 && !loading ? (
          <div style={{
            textAlign: 'center',
            color: '#475569',
            fontSize: '0.85rem',
            marginTop: '40px',
          }}>
            No messages yet. Say hi! 👋
          </div>
        ) : null}

        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: senderColor(m.sender_name) }}>
                {m.sender_name}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#475569' }}>
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '0 12px 12px 12px',
              padding: '8px 12px',
              fontSize: '0.875rem',
              color: '#cbd5e1',
              maxWidth: '85%',
              wordBreak: 'break-word',
              lineHeight: 1.5,
            }}>
              {m.message}
            </div>
          </div>
        ))}
      </div>

      {/* Input Bar */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send() }}
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
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          style={{
            height: '40px',
            padding: '0 16px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: sending || !text.trim() ? 'not-allowed' : 'pointer',
            opacity: sending || !text.trim() ? 0.5 : 1,
            transition: 'all 0.2s',
            fontFamily: 'inherit',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {sending ? '⟳' : '↑ Send'}
        </button>
      </div>
    </div>
  )
}
