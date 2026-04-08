import { useEffect, useRef, useState } from 'react'

import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ErrorBanner } from '../../components/ErrorBanner'
import { Loading } from '../../components/Loading'
import { apiFetch } from '../../lib/api'

type MessageRow = {
  id: string
  classroom_id: string
  sender_id: string
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

    // Messages are stored in MongoDB (backend). Use polling for MVP simplicity.
    const intervalId = window.setInterval(load, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
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

  return (
    <Card className="space-y-3">
      <div className="text-sm font-semibold text-slate-900">Chat</div>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <Loading /> : null}

      <div
        ref={listRef}
        className="h-[420px] space-y-2 overflow-auto rounded-md border border-slate-200 bg-white p-3"
      >
        {messages.length === 0 && !loading ? (
          <div className="text-sm text-slate-600">No messages yet. Say hi.</div>
        ) : null}

        {messages.map((m) => (
          <div key={m.id} className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">
              {m.sender_id} · {new Date(m.timestamp).toLocaleTimeString()}
            </div>
            <div className="text-sm text-slate-900">{m.message}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          onKeyDown={(e) => {
            if (e.key === 'Enter') send()
          }}
        />
        <Button loading={sending} onClick={send} type="button">
          Send
        </Button>
      </div>
    </Card>
  )
}

