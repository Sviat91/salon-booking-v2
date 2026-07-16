import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface DataCardField {
  label: string
  value: ReactNode
}

interface DataCardProps {
  /** Optional prominent field shown large above the secondary field grid. */
  title?: ReactNode
  fields: DataCardField[]
  actions?: ReactNode
  className?: string
}

/**
 * Shared mobile-row card for admin `<table>` surfaces (see admin/AGENTS.md's table→card
 * pattern). Chrome matches the table container convention:
 * `rounded-[20px] border border-border bg-card shadow-sm`.
 */
export default function DataCard({ title, fields, actions, className }: DataCardProps) {
  return (
    <div className={cn("rounded-[20px] border border-border bg-card shadow-sm p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {title && (
            <div className="text-[15px] font-medium text-foreground truncate mb-2">{title}</div>
          )}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
            {fields.map((field, i) => (
              <div key={i} className="min-w-0">
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="mt-0.5 text-sm text-foreground truncate">{field.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {actions && <div className="flex items-center gap-0.5 shrink-0">{actions}</div>}
      </div>
    </div>
  )
}
