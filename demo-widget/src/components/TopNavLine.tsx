import type { ReactNode } from 'react'
import PageBackLink from './PageBackLink'
import { cn } from '../lib/utils'

interface TopNavLineProps {
  className?: string
  actions?: ReactNode
  /** If omitted, no Back control is rendered — the homepage has nothing to go back to. */
  onBack?: () => void
  leadingSpaceClassName?: string
}

/**
 * Nav line shared by the homepage and every master's booking page — ported
 * from the real app's TopNavLine.tsx. This demo has no content pages, so the
 * tab strip/burger menu is always empty; the hairline + back button + actions
 * cluster (the part the real screenshots were being compared against) are
 * kept exactly as in the source.
 */
export default function TopNavLine({ className, actions, onBack, leadingSpaceClassName }: TopNavLineProps) {
  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center justify-between gap-3 pr-2 pb-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onBack && (
            <PageBackLink onClick={onBack} iconOnly className="lg:-ml-[6.25rem] xl:-ml-[7.25rem]" />
          )}
          <nav className={cn('hidden min-w-0 flex-1 overflow-x-auto lg:block', leadingSpaceClassName)} />
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border',
          leadingSpaceClassName
            ? '[mask-image:linear-gradient(to_right,transparent,black_12rem,black_100%)]'
            : '[mask-image:linear-gradient(to_right,transparent,black_1rem,black_100%)]'
        )}
      />
    </div>
  )
}
