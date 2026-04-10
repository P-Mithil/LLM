import type { PropsWithChildren } from 'react'

const styles: Record<string, React.CSSProperties> = {
  slate: {
    background: 'rgba(255,255,255,0.06)',
    color: '#94a3b8',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  indigo: {
    background: 'rgba(99,102,241,0.15)',
    color: '#a5b4fc',
    border: '1px solid rgba(99,102,241,0.3)',
  },
}

export function Badge({
  children,
  variant = 'slate',
}: PropsWithChildren<{ variant?: 'slate' | 'indigo' }>) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: '9999px',
      padding: '3px 10px',
      fontSize: '0.72rem',
      fontWeight: 600,
      ...styles[variant],
    }}>
      {children}
    </span>
  )
}
