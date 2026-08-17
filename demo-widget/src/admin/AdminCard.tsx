import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

// The shared card/table shell used across the real admin:
// `rounded-[20px] border border-border bg-card shadow-sm`.
export default function AdminCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-[20px] border border-border bg-card shadow-sm overflow-hidden', className)}>{children}</div>
}

export function AdminSectionHeader({ eyebrow, description }: { eyebrow: string; description: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-medium uppercase tracking-wider text-primary">{eyebrow}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
