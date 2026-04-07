import type { SelectHTMLAttributes } from 'react'

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
}

export function Select({ label, className = '', children, ...rest }: Props) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-slate-700">{label}</div>
      <select
        {...rest}
        className={[
          'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-slate-400',
          className,
        ].join(' ')}
      >
        {children}
      </select>
    </label>
  )
}

