import type { ReactNode } from 'react'
import PageBackLink from './PageBackLink'
import { cn } from '../lib/utils'

export interface NavTab {
  id: string
  title: string
  active: boolean
  onClick: () => void
}

interface TopNavLineProps {
  className?: string
  actions?: ReactNode
  /** If omitted, no Back control is rendered — the homepage has nothing to go back to. */
  onBack?: () => void
  leadingSpaceClassName?: string
  tabs?: NavTab[]
}

/**
 * Nav line shared by every page — ported from the real app's TopNavLine.tsx.
 * The real component collapses tabs into a burger menu below `lg` (via a
 * Radix dropdown) when there could be several content pages; this demo only
 * ever has one ("About Us"), so that dropdown isn't worth porting — a single
 * tab renders inline at every breakpoint instead of a 1-item menu.
 */
export default function TopNavLine({ className, actions, onBack, leadingSpaceClassName, tabs = [] }: TopNavLineProps) {
  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center justify-between gap-3 pr-2 pb-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onBack && (
            <PageBackLink onClick={onBack} iconOnly className="lg:-ml-[6.25rem] xl:-ml-[7.25rem]" />
          )}
          <nav className={cn('min-w-0 flex-1 overflow-x-auto', leadingSpaceClassName)}>
            <div className="flex w-max items-center gap-5 px-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={tab.onClick}
                  className={cn(
                    'block shrink-0 whitespace-nowrap border-b-2 px-0.5 pb-0 text-sm font-medium tracking-tight transition-colors duration-200',
                    tab.active ? 'border-primary text-foreground' : 'border-transparent text-foreground/60 hover:text-foreground'
                  )}
                >
                  {tab.title}
                </button>
              ))}
            </div>
          </nav>
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
