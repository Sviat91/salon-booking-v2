import { cn } from '../../lib/utils'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
}

// Minimal inert port of the real ui/switch.tsx — pill toggle with a sliding
// thumb, controlled via checked/onChange.
export default function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[18.4px] w-[32px] shrink-0 items-center rounded-full border border-transparent transition-colors',
        checked ? 'bg-primary' : 'bg-input',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <span
        className={cn(
          'block h-4 w-4 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-[calc(100%-2px)]' : 'translate-x-0'
        )}
      />
    </button>
  )

  if (!label) return button

  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      {button}
      {label}
    </label>
  )
}
