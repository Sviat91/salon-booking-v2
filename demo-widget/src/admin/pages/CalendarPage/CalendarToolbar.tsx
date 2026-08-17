import { ChevronLeft, ChevronRight, ChevronDown as SelectChevron, Edit3, Calendar as CalendarIcon } from 'lucide-react'
import MasterSelectDropdown from './MasterSelectDropdown'
import type { ViewType } from './calendarUtils'

interface CalendarToolbarProps {
  view: ViewType
  setView: (v: ViewType) => void
  headerLabel: string
  todayLabel: string
  selectedMasterId: string
  masters: { id: string; name: string; color: string }[]
  onMasterChange: (id: string) => void
  onBulkClick: () => void
  step: number
  setStep: (n: number) => void
}

// Ported from the real CalendarToolbar.tsx (desktop layout only — the real
// component also has a separate isMobile branch with a bottom sheet for
// controls; out of scope here, this demo's toolbar just wraps on narrow
// widths like the rest of the admin). Today/prev/next stay inert (always
// showing the current week/month/day, same as before); view toggle and the
// master filter are the two genuinely functional controls per the plan.
export default function CalendarToolbar({ view, setView, headerLabel, todayLabel, selectedMasterId, masters, onMasterChange, onBulkClick, step, setStep }: CalendarToolbarProps) {
  return (
    <div className="min-h-[4rem] py-2 border-b border-border/60 px-4 shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-4">
        <div className="flex items-center gap-4">
          <button className="rounded-md border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            Today <span className="opacity-70 ml-1">· {todayLabel}</span>
          </button>
          <div className="flex items-center gap-1">
            <button className="flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-xl font-semibold min-w-[150px]">{headerLabel}</h2>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex rounded-full border border-border bg-transparent p-0.5 gap-0.5">
            {(['Month', 'Week', 'Day'] as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-full ${
                  v === view ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className="inline-block min-w-[8ch] text-center">{v}</span>
              </button>
            ))}
          </div>
          <MasterSelectDropdown selectedMasterId={selectedMasterId} masters={masters} onChange={onMasterChange} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-3">
        <div className="relative flex items-center">
          <select
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            disabled={view === 'Month'}
            className="appearance-none flex items-center gap-1 h-auto w-auto rounded-md bg-transparent hover:bg-muted px-3 py-1.5 pr-7 text-sm font-medium shadow-sm border border-border disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {[5, 10, 15, 30, 60].map((s) => (
              <option key={s} value={s}>{s} min</option>
            ))}
          </select>
          <SelectChevron className="h-3.5 w-3.5 opacity-60 absolute right-2 pointer-events-none" />
        </div>
        <div className="h-6 w-px bg-border" />
        <button className="flex items-center gap-2 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
          <Edit3 className="w-4 h-4" />
          <span className="hidden sm:inline-block min-w-[24ch] text-center">Edit Schedule</span>
        </button>
        <button
          onClick={onBulkClick}
          className="flex items-center gap-2 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <CalendarIcon className="w-4 h-4" />
          <span className="hidden sm:inline-block min-w-[29ch] text-center">Bulk Schedule Edit</span>
        </button>
      </div>
    </div>
  )
}
