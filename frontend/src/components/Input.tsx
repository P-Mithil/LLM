import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
}

export function Input({ label, className = '', style, ...rest }: Props) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ marginBottom: '6px', fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>{label}</div>
      <input
        {...rest}
        className={className}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '0.875rem',
          color: '#e2e8f0',
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          ...style,
        }}
        onFocus={e => (e.target.style.borderColor = 'rgba(129,140,248,0.6)')}
        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
      />
    </label>
  )
}

