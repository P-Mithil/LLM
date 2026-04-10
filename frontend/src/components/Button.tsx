import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type Props = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'danger'
    size?: 'sm' | 'md'
    loading?: boolean
  }
>

const baseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontWeight: 500,
  borderRadius: '10px',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  fontFamily: 'inherit',
  letterSpacing: '0.01em',
  userSelect: 'none',
}

const variants: Record<NonNullable<Props['variant']>, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    boxShadow: '0 0 20px rgba(99,102,241,0.25)',
  },
  secondary: {
    background: 'rgba(255,255,255,0.06)',
    color: '#cbd5e1',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  danger: {
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    color: '#fff',
    boxShadow: '0 0 20px rgba(239,68,68,0.25)',
  },
}

const sizes: Record<NonNullable<Props['size']>, React.CSSProperties> = {
  sm: { height: '34px', padding: '0 12px', fontSize: '0.8rem' },
  md: { height: '40px', padding: '0 18px', fontSize: '0.875rem' },
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || loading
  return (
    <button
      {...rest}
      disabled={isDisabled}
      className={className}
      style={{
        ...baseStyle,
        ...variants[variant],
        ...sizes[size],
        ...(isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
        ...style,
      }}
      onMouseEnter={e => {
        if (!isDisabled) e.currentTarget.style.filter = 'brightness(1.15)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.filter = ''
      }}
    >
      {loading ? '⟳ Loading…' : children}
    </button>
  )
}
