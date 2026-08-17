import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type BadgeVariant = 'default' | 'secondary' | 'accent' | 'outline' | 'muted' | 'success' | 'warning' | 'destructive'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  accent: 'bg-accent text-accent-foreground',
  outline: 'border border-border text-foreground',
  muted: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  destructive: 'bg-red-500/15 text-red-600 dark:text-red-400',
}

// Ported from the real ui/badge.tsx — pill shape, same variant set used
// across the admin (status/type cells in tables).
export default function Badge({
  variant = 'default',
  className,
  children,
}: {
  variant?: BadgeVariant
  className?: string
  children: ReactNode
}) {
  return (
    <span className={cn('inline-flex items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', VARIANT_CLASSES[variant], className)}>
      {children}
    </span>
  )
}
