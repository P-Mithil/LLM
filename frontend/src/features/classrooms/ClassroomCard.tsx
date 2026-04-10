import { Link } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import type { Classroom } from './types'

export function ClassroomCard({ classroom }: { classroom: Classroom }) {
  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      padding: '20px',
      transition: 'border-color 0.2s, background 0.2s',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.35)'
        ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)'
        ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'
      }}
    >
      {/* Glow accent */}
      <div style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {classroom.course_name}
            </span>
            <Badge variant="indigo">{classroom.course_code}</Badge>
          </div>
          <div style={{ fontSize: '0.83rem', color: '#475569', marginBottom: '10px', lineHeight: 1.4 }}>
            {classroom.description || 'No description'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#334155' }}>
            Code: <span style={{ fontFamily: 'monospace', color: '#64748b', letterSpacing: '0.05em' }}>{classroom.class_code}</span>
          </div>
        </div>

        <Link to={`/classrooms/${classroom.id}`} style={{ flexShrink: 0 }}>
          <Button size="sm">Open →</Button>
        </Link>
      </div>
    </div>
  )
}
