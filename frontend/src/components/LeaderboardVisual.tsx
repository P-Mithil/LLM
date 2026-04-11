import React from 'react'

export type LeaderboardEntry = {
  rank: number
  name: string
  marks: string
  percentage: string
}

type Props = {
  data: LeaderboardEntry[]
}

export function LeaderboardVisual({ data }: Props) {
  if (!data || data.length === 0) return null

  // Sort just in case
  const sorted = [...data].sort((a, b) => a.rank - b.rank)

  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  // Reorder top 3 for podium: [2, 1, 3]
  const podium = []
  if (top3[1]) podium.push({ ...top3[1], _p: 2 })
  if (top3[0]) podium.push({ ...top3[0], _p: 1 })
  if (top3[2]) podium.push({ ...top3[2], _p: 3 })

  const getAvatar = (name: string) => `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=1e293b,334155,475569`

  return (
    <div style={{
      width: '100%',
      background: 'linear-gradient(180deg, #1f2028 0%, #17181e 100%)',
      borderRadius: '24px',
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Podium Section */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: '16px',
        marginBottom: '60px',
        minHeight: '220px'
      }}>
        {podium.map((entry, idx) => {
          const isFirst = entry._p === 1
          const isSecond = entry._p === 2
          
          const height = isFirst ? '140px' : isSecond ? '100px' : '80px'
          const avatarSize = isFirst ? '100px' : '80px'
          const crownColor = isFirst ? '#fbbf24' : isSecond ? '#94a3b8' : '#b45309'
          const crownIcon = '👑'

          return (
            <div key={entry.name} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '120px',
            }}>
              {/* Avatar & Crown */}
              <div style={{ position: 'relative', marginBottom: '-15px', zIndex: 10 }}>
                <div style={{
                  position: 'absolute',
                  top: '-25px', left: '50%', transform: 'translateX(-50%)',
                  fontSize: isFirst ? '32px' : '24px',
                  filter: `drop-shadow(0 4px 6px rgba(0,0,0,0.5))`
                }}>
                  {crownIcon}
                </div>
                <div style={{
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: '50%',
                  border: `4px solid ${crownColor}`,
                  boxShadow: `0 8px 24px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.3)`,
                  background: '#2d3748',
                  overflow: 'hidden',
                  padding: '4px'
                }}>
                  <img src={getAvatar(entry.name)} alt={entry.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                </div>
              </div>

              {/* Pedestal Block */}
              <div style={{
                width: '100%',
                height: height,
                background: 'linear-gradient(180deg, #333644 0%, #1f2028 100%)',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                border: '1px solid rgba(255,255,255,0.05)',
                borderBottom: 'none',
                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1), 0 -10px 40px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '25px'
              }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: crownColor, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                  {entry.name}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600, marginTop: '4px' }}>
                  {entry.percentage}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* List Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '600px', margin: '0 auto' }}>
        {rest.map(entry => (
          <div key={entry.name} style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '16px',
            padding: '12px 20px',
            transition: 'transform 0.2s, background 0.2s',
            cursor: 'default',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            {/* Rank Circle */}
            <div style={{
              width: '32px', height: '32px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.9rem', color: '#cbd5e1',
              flexShrink: 0
            }}>
              {entry.rank}
            </div>

            {/* Avatar */}
            <img 
              src={getAvatar(entry.name)} 
              alt={entry.name} 
              style={{ width: '40px', height: '40px', borderRadius: '50%', marginLeft: '16px', border: '2px solid rgba(255,255,255,0.1)' }} 
            />

            {/* Name */}
            <div style={{ flex: 1, marginLeft: '16px', fontWeight: 600, fontSize: '1.05rem', color: '#f8fafc' }}>
              {entry.name}
            </div>

            {/* Stats */}
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Marks: <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{entry.marks}</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Score: <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{entry.percentage}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
