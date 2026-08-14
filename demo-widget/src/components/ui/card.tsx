import * as React from 'react'
import { cn } from '../../lib/utils'

const CardBase = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & { size?: 'default' | 'sm'; title?: string }
>(({ className, size = 'default', title, children, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card"
    data-size={size}
    className={cn(
      'group/card flex flex-col gap-4 overflow-hidden rounded-[--radius] bg-card py-4 text-sm text-card-foreground shadow-sm ring-1 ring-foreground/5 data-[size=sm]:gap-3 data-[size=sm]:py-3',
      className
    )}
    {...props}
  >
    {title && (
      <div data-slot="card-header" className="px-4 group-data-[size=sm]/card:px-3">
        <div data-slot="card-title" className="text-base leading-snug font-medium group-data-[size=sm]/card:text-sm">
          {title}
        </div>
      </div>
    )}
    {children}
  </div>
))
CardBase.displayName = 'Card'
export const Card = CardBase
