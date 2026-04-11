import { Link } from 'react-router-dom'
import type { Classroom } from './types'

// Rotates through Google Classroom-like header colours
const HEADER_COLORS = [
  'linear-gradient(135deg, #1e3a5f 0%, #26547c 100%)',
  'linear-gradient(135deg, #7b2d8b 0%, #a855f7 100%)',
  'linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)',
  'linear-gradient(135deg, #16a085  0%, #1abc9c 100%)',
  'linear-gradient(135deg, #d35400 0%, #f39c12 100%)',
  'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
  'linear-gradient(135deg, #2980b9 0%, #3498db 100%)',
  'linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%)',
]

function hashColor(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff
  return HEADER_COLORS[Math.abs(h) % HEADER_COLORS.length]
}

export function ClassroomCard({ classroom }: { classroom: Classroom }) {
  const bg = hashColor(classroom.id)
  const initial = (classroom.course_name?.[0] ?? '?').toUpperCase()

  return (
    <Link
      to={`/classrooms/${classroom.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        style={{
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#1e1e2e',
          border: '1px solid rgba(255,255,255,0.08)',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease',
          cursor: 'pointer',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.transform = 'translateY(-4px)'
          el.style.boxShadow = '0 12px 32px rgba(0,0,0,0.45)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.transform = 'translateY(0)'
          el.style.boxShadow = 'none'
        }}
      >
        {/* Coloured header banner */}
        <div
          style={{
            background: bg,
            height: '100px',
            padding: '14px 16px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#fff',
                lineHeight: 1.3,
                maxWidth: '80%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {classroom.course_name}
            </div>
            {classroom.course_code ? (
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)', marginTop: '2px' }}>
                {classroom.course_code}
              </div>
            ) : null}
          </div>

          {/* Avatar (bottom-right of header) */}
          <div
            style={{
              position: 'absolute',
              bottom: '-20px',
              right: '16px',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: bg,
              border: '3px solid #1e1e2e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              fontWeight: 700,
              color: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            {initial}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 16px 12px', minHeight: '70px' }}>
          <div
            style={{
              fontSize: '0.8rem',
              color: '#94a3b8',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
              lineHeight: 1.5,
            }}
          >
            {classroom.description || 'No description'}
          </div>
        </div>

        {/* Footer action bar */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: '0.72rem',
              color: '#475569',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
            }}
          >
            {classroom.class_code}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {/* People icon */}
            <button
              onClick={e => e.preventDefault()}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                transition: 'background 0.15s',
              }}
              title="Members"
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'none')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </button>
            {/* Folder icon */}
            <button
              onClick={e => e.preventDefault()}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                transition: 'background 0.15s',
              }}
              title="Open classroom"
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'none')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            {/* More options */}
            <button
              onClick={e => e.preventDefault()}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                transition: 'background 0.15s',
              }}
              title="More"
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'none')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Link>
  )
}
