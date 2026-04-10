export function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: '10px',
      padding: '10px 14px',
      fontSize: '0.85rem',
      color: '#fca5a5',
    }}>
      ⚠️ {message}
    </div>
  )
}

