import { ChevronLeft, ChevronRight, Clock, Plus, Trash2, User, Users, X } from 'lucide-react'
import { monthGridDays } from './calendarUtils'

interface BulkSettingsModalProps {
  masters: { id: string; name: string; color: string }[]
  onClose: () => void
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Simplified structural port of the real BulkSettingsModal.tsx multi-day/
// multi-master schedule editor. The real component drives live date
// selection, per-master working/day-off marks fetched per month, and an
// editable interval list, all backed by schedule overrides this demo
// doesn't model (same "no mock schedule data" reasoning as Week/Day/Month
// view — Edit Schedule stays fully inert). Every field/control is shown
// with its real label and layout but disabled; Apply Settings just closes.
export default function BulkSettingsModal({ masters, onClose }: BulkSettingsModalProps) {
  const days = monthGridDays(new Date())
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const currentMonth = new Date().getMonth()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-y-auto rounded-xl border border-border/50 bg-card text-card-foreground shadow-2xl md:flex-row">
        {/* Left: calendar picker */}
        <div className="flex-1 border-b border-border/50 p-6 md:border-b-0 md:border-r">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Select Dates</h3>
            <span className="rounded-full border border-border/50 bg-muted/60 px-3 py-1 text-sm font-medium text-muted-foreground">0 selected</span>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/40 p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between px-2">
              <button className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-[15px] font-semibold">{monthLabel}</span>
              <button className="flex h-8 w-8 items-center justify-center rounded-md text-card-foreground hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DAY_LABELS.map((label) => (
                <div key={label} className="pb-2 text-center text-xs font-semibold text-muted-foreground">{label}</div>
              ))}
              {days.map((d) => {
                const inMonth = d.getMonth() === currentMonth
                const isPast = d < new Date(new Date().setHours(0, 0, 0, 0))
                return (
                  <div
                    key={d.toDateString()}
                    className={`flex aspect-square items-center justify-center rounded-md text-sm ${
                      !inMonth || isPast ? 'text-muted-foreground/40' : 'text-foreground'
                    }`}
                  >
                    {d.getDate()}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: settings */}
        <div className="flex w-full flex-col p-6 md:w-[320px]">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Configure</h3>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto pr-2">
            <div className="space-y-3">
              <span className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /> Apply to masters</span>
              <div className="rounded-xl border border-border/50 bg-muted/40 p-4 shadow-sm">
                <label className="flex items-center gap-3 rounded-lg border border-transparent p-3 opacity-60">
                  <input type="checkbox" disabled className="h-4 w-4 rounded accent-primary" />
                  <span className="font-semibold text-foreground">Apply to all masters</span>
                </label>
                <div className="mt-3 max-h-[160px] space-y-1 overflow-y-auto rounded-lg border border-border/50 bg-card p-2 shadow-inner">
                  {masters.map((m, i) => (
                    <label key={m.id} className="flex items-center gap-3 rounded p-2.5 text-sm opacity-60">
                      <input type="checkbox" disabled defaultChecked={i === 0} className="h-4 w-4 rounded accent-primary" />
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border" style={{ backgroundColor: m.color }} />
                        <User className="h-3.5 w-3.5" />{m.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <span className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4" /> Schedule configuration</span>
              <div className="rounded-xl border border-border/50 bg-muted/40 p-4 shadow-sm">
                <label className="mb-2 flex items-center gap-3 rounded-lg border border-transparent p-3 opacity-60">
                  <input type="checkbox" disabled className="h-4 w-4 rounded accent-primary" />
                  <span className="font-semibold text-red-600">Mark selected days off</span>
                </label>

                <div className="mt-4 border-t border-border pt-4">
                  <div className="mb-3 flex items-center justify-between pl-2">
                    <span className="text-sm font-medium text-muted-foreground">Working intervals</span>
                    <button disabled className="flex h-8 items-center gap-1 rounded-md border border-border bg-transparent px-2 text-xs font-medium opacity-50">
                      <Plus className="h-3 w-3" /> Add interval
                    </button>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-card p-2 shadow-inner">
                    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/40 p-2.5 opacity-60">
                      <input disabled type="time" defaultValue="09:00" className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm" />
                      <span className="font-medium text-muted-foreground/60">-</span>
                      <input disabled type="time" defaultValue="18:00" className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm" />
                      <button disabled className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground/60">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 shrink-0 border-t border-border pt-4">
            <button onClick={onClose} className="w-full rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 transition-opacity">
              Apply Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
