import { cn } from '../../lib/utils'

interface SubNavProps {
  tabs: { key: string; label: string }[]
  active: string
  onChange: (key: string) => void
}

// Minimal inert port of the real DatabaseSubNav.tsx — 2-tab underline nav,
// local active-tab state driven by the parent (no routing needed for a
// single-page demo).
export default function SubNav({ tabs, active, onChange }: SubNavProps) {
  return (
    <div className="mb-6 flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            active === tab.key
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
