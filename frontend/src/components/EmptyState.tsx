export function EmptyState({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div style={{
      border: '1px dashed rgba(255,255,255,0.1)',
      borderRadius: '16px',
      padding: '40px 24px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📂</div>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#94a3b8' }}>{title}</div>
      {subtitle ? (
        <div style={{ marginTop: '4px', fontSize: '0.82rem', color: '#475569' }}>{subtitle}</div>
      ) : null}
    </div>
  )
}
