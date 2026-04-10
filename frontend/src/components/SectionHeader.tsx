export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '8px 0 16px' }}>
      <div>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #e2e8f0, #94a3b8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          margin: 0,
        }}>{title}</h1>
        {subtitle ? (
          <p style={{ marginTop: '4px', fontSize: '0.875rem', color: '#64748b', margin: '4px 0 0' }}>{subtitle}</p>
        ) : null}
      </div>
      {right ? <div style={{ flexShrink: 0 }}>{right}</div> : null}
    </div>
  )
}
