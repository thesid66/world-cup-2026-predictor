type TeamFlagProps = {
  code?: string
  label?: string
  name?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl'
}

export function TeamFlag({ code, label, name, className = '', size = 'md' }: TeamFlagProps) {
  const accessibleLabel = label ?? name

  if (!code) {
    return (
      <span className={`inline-flex h-5 w-7 items-center justify-center rounded-sm bg-slate-700 text-[10px] font-black text-slate-300 ${className}`}>
        ?
      </span>
    )
  }

  return (
    <span
      role="img"
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={`fi fi-${code} rounded-[3px] shadow-sm ring-1 ring-white/20 ${sizeClasses[size]} ${className}`}
    />
  )
}
