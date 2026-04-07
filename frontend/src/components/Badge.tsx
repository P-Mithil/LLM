import type { PropsWithChildren } from 'react'

export function Badge({
  children,
  variant = 'slate',
}: PropsWithChildren<{ variant?: 'slate' | 'indigo' }>) {
  const cls =
    variant === 'indigo'
      ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
      : 'bg-slate-100 text-slate-700 ring-slate-200'

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`}>
      {children}
    </span>
  )
}

