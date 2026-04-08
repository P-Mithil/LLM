import { useEffect, useRef, useState } from 'react'

import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ErrorBanner } from '../../components/ErrorBanner'
import { Loading } from '../../components/Loading'
import { apiFetch } from '../../lib/api'

type AiChatResponse = {
  answer: string
  steps: string[]
  tips: string[]
  sources?: { chunk_id?: string; title?: string; source_url?: string }[]
}

type Turn = {
  role: 'user' | 'assistant'
  text: string
}

export function AiTutorPanel({ classroomId }: { classroomId: string }) {
  const [history, setHistory] = useState<Turn[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [history.length, loading])

  async function ask() {
    const q = text.trim()
    if (!q) return
    setError(null)
    setLoading(true)
    setHistory((prev) => [...prev, { role: 'user', text: q }])
    setText('')

    try {
      const res = await apiFetch<AiChatResponse>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ classroom_id: classroomId, question: q }),
      })

      const parts: string[] = []
      if (res.answer) parts.push(res.answer)
      if (res.steps?.length) parts.push(`Steps:\n- ${res.steps.join('\n- ')}`)
      if (res.tips?.length) parts.push(`Tips:\n- ${res.tips.join('\n- ')}`)

      setHistory((prev) => [
        ...prev,
        { role: 'assistant', text: parts.join('\n\n') || 'No response.' },
      ])
    } catch (e) {
      setError((e as { message?: string })?.message || 'AI chat failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">AI Tutor</div>
        <div className="text-xs text-slate-500">Uses your class materials (if indexed)</div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div
        ref={listRef}
        className="h-[420px] space-y-2 overflow-auto rounded-md border border-slate-200 bg-white p-3"
      >
        {history.length === 0 && !loading ? (
          <div className="text-sm text-slate-600">
            Ask a doubt here. If your faculty indexed syllabus/notes, it will answer using those.
          </div>
        ) : null}

        {history.map((t, idx) => (
          <div
            key={idx}
            className={[
              'rounded-lg px-3 py-2',
              t.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900',
            ].join(' ')}
          >
            <div className="whitespace-pre-wrap text-sm">{t.text}</div>
          </div>
        ))}

        {loading ? (
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <Loading />
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask your doubt…"
          className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          onKeyDown={(e) => {
            if (e.key === 'Enter') ask()
          }}
        />
        <Button loading={loading} onClick={ask} type="button">
          Ask
        </Button>
      </div>
    </Card>
  )
}

