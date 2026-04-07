import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type Props = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'danger'
    size?: 'sm' | 'md'
    loading?: boolean
  }
>

const variants: Record<NonNullable<Props['variant']>, string> = {
  primary:
    'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400 shadow-sm',
  secondary:
    'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 disabled:text-slate-400 shadow-sm',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 disabled:bg-rose-300 shadow-sm',
}

const sizes: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        'inline-flex select-none items-center justify-center gap-2 rounded-md font-medium transition',
        'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 active:translate-y-[0.5px]',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
    >
      {loading ? 'Loading…' : children}
    </button>
  )
}

