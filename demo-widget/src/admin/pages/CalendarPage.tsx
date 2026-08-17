import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Globe, ChevronDown as SelectChevron, Edit3, Calendar as CalendarIcon } from 'lucide-react'
import { masters } from '../../data'
import { weekAppointments, MASTER_COLORS } from '../mockAdminData'
import AdminCard from '../AdminCard'

const PIXELS_PER_MINUTE = 1.5
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const CONTAINER_HEIGHT = 24 * 60 * PIXELS_PER_MINUTE

function startOfWeek(d: Date) {
  const date = new Date(d)
  const day = (date.getDay() + 6) % 7 // Monday = 0
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}

// Ported from the real ModernCalendar/WeekView (src/app/admin/master/calendar/)
// — hand-rolled, no calendar library, absolute-positioned event blocks at
// 1.5px/minute, master color read straight from a hex value (+ hex-alpha
// suffix for the background) exactly like the real component. Toolbar
// controls (Today/prev/next/view toggle/master filter/duration/Edit
// Schedule/Bulk Schedule Edit) are all present for visual fidelity but
// inert — this demo is read-only outside Settings, always showing the
// current week.
export default function CalendarPage() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const weekStart = startOfWeek(new Date())
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
  const weekEnd = days[6]
  const todayKey = new Date().toDateString()
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowPixels = nowMinutes * PIXELS_PER_MINUTE

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 7 * 60 * PIXELS_PER_MINUTE })
  }, [])

  const headerLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  const todayLabel = now.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })

  return (
    <AdminCard className="flex h-[calc(100vh-10rem)] min-h-[560px] flex-col rounded-[20px]">
      {/* Toolbar */}
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
              {['Month', 'Week', 'Day'].map((v) => (
                <button
                  key={v}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-full ${
                    v === 'Week' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="inline-block min-w-[8ch] text-center">{v}</span>
                </button>
              ))}
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-transparent hover:bg-muted rounded-md transition-colors border border-border">
              <Globe className="h-4 w-4" />
              <span className="min-w-[22ch] text-center">All Masters</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-3">
          <button className="flex items-center gap-1 h-auto w-auto rounded-md bg-transparent hover:bg-muted px-3 py-1.5 text-sm font-medium shadow-sm border border-border">
            60 min <SelectChevron className="h-3.5 w-3.5 opacity-60" />
          </button>
          <div className="h-6 w-px bg-border" />
          <button className="flex items-center gap-2 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Edit3 className="w-4 h-4" />
            <span className="hidden sm:inline-block min-w-[24ch] text-center">Edit Schedule</span>
          </button>
          <button className="flex items-center gap-2 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <CalendarIcon className="w-4 h-4" />
            <span className="hidden sm:inline-block min-w-[29ch] text-center">Bulk Schedule Edit</span>
          </button>
        </div>
      </div>

      {/* Day header row */}
      <div className="flex border-b border-border shrink-0 bg-card pr-2">
        <div className="w-16 shrink-0 border-r border-border" />
        <div className="flex-1 grid grid-cols-7">
          {days.map((d) => {
            const isToday = d.toDateString() === todayKey
            return (
              <div key={d.toDateString()} className="pt-2 pb-1 px-1 flex flex-col items-center border-r last:border-r-0 border-border">
                <span className={`text-[11px] font-medium uppercase tracking-wider ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className={`text-lg font-medium h-8 w-8 flex items-center justify-center rounded-full mt-0.5 ${isToday ? 'bg-primary text-primary-foreground' : ''}`}>
                  {d.getDate()}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Scrollable grid body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        <div className="flex" style={{ height: CONTAINER_HEIGHT }}>
          <div className="w-16 shrink-0 border-r border-border bg-card relative z-10">
            {HOURS.map((h) => (
              <div key={h} className="absolute px-2 text-right text-xs text-muted-foreground font-medium w-full" style={{ top: h * 60 * PIXELS_PER_MINUTE + 12 }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          <div className="flex-1 grid grid-cols-7 relative" style={{ height: CONTAINER_HEIGHT }}>
            {days.map((d) => {
              const isToday = d.toDateString() === todayKey
              const dayAppointments = weekAppointments.filter((a) => new Date(a.startISO).toDateString() === d.toDateString())
              return (
                <div key={d.toDateString()} className="relative border-r last:border-r-0 border-border/80">
                  {HOURS.map((h) => (
                    <div key={h} className="absolute w-full border-t border-border/60 pointer-events-none" style={{ top: h * 60 * PIXELS_PER_MINUTE }} />
                  ))}

                  {isToday && nowPixels > 0 && nowPixels < CONTAINER_HEIGHT && (
                    <div className="absolute w-full z-20 pointer-events-none" style={{ top: nowPixels }}>
                      <div className="h-2 w-2 bg-red-500 rounded-full absolute -left-1 -top-1" />
                      <div className="w-full border-t-[2px] border-red-500" />
                    </div>
                  )}

                  {dayAppointments.map((a) => {
                    const start = new Date(a.startISO)
                    const end = new Date(a.endISO)
                    const top = (start.getHours() * 60 + start.getMinutes()) * PIXELS_PER_MINUTE
                    const height = Math.max(24, ((end.getTime() - start.getTime()) / 60_000) * PIXELS_PER_MINUTE)
                    const master = masters.find((m) => m.id === a.masterId)
                    const color = MASTER_COLORS[a.masterId] ?? '#8B4A58'
                    return (
                      <div
                        key={a.id}
                        className="absolute w-[calc(100%-8px)] rounded-md p-1 text-xs overflow-hidden hover:z-30 hover:shadow-md hover:ring-2 ring-primary/40 transition-all text-foreground"
                        style={{ top, minHeight: height, left: 4, zIndex: 10, backgroundColor: color + '26', borderLeft: `3px solid ${color}` }}
                      >
                        <div className="font-semibold leading-tight truncate">{a.clientName}</div>
                        <div className="opacity-90 leading-tight truncate mt-0.5">{a.procedureName}</div>
                        <div className="opacity-75 leading-tight text-[10px] mt-0.5 truncate">
                          {master?.name} · {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AdminCard>
  )
}
