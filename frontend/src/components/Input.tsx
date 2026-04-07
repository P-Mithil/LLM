import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
}

export function Input({ label, className = '', ...rest }: Props) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-slate-700">{label}</div>
      <input
        {...rest}
        className={[
          'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-slate-400',
          className,
        ].join(' ')}
      />
    </label>
  )
}

