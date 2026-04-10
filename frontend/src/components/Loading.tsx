export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '0.85rem' }}>
      <span style={{
        display: 'inline-block',
        width: '14px',
        height: '14px',
        border: '2px solid rgba(129,140,248,0.3)',
        borderTopColor: '#818cf8',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {label}
    </div>
  )
}
