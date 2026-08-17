import { masters } from '../../../data'
import { MASTER_COLORS, type MockAppointment } from '../../mockAdminData'
import { END_HOUR, PIXELS_PER_MINUTE, START_HOUR, appointmentsOnDay, formatTime, startOfWeek } from './calendarUtils'

const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
const CONTAINER_HEIGHT = (END_HOUR - START_HOUR) * 60 * PIXELS_PER_MINUTE

interface WeekViewProps {
  currentDate: Date
  appointments: MockAppointment[]
  onAppointmentClick: (a: MockAppointment) => void
  onDayClick: (d: Date) => void
  step: number
}

// Ported from the original CalendarPage.tsx week grid (itself a port of the
// real WeekView.tsx) — absolute-positioned event blocks at 1.5px/minute.
// Overlap-grouping/day-off-shift editing from the real component are dropped
// (no schedule mock data exists, "Edit Schedule" stays inert, and the mock
// appointments never overlap by construction). New here: appointment blocks
// open ViewAppointmentModal, and empty day-column space jumps to Day view —
// both match the real WeekView.tsx behavior.
export default function WeekView({ currentDate, appointments, onAppointmentClick, onDayClick, step }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
  const todayKey = new Date().toDateString()
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60
  const nowPixels = nowMinutes * PIXELS_PER_MINUTE

  // Step-based minute gridlines ((END_HOUR-START_HOUR)h * 60/step + 1 lines),
  // matching the real WeekView.tsx: hour-boundary lines solid, sub-hour lines
  // dashed/fainter.
  const timeLines = Array.from({ length: (END_HOUR - START_HOUR) * Math.floor(60 / step) + 1 }, (_, i) => {
    const currentMin = i * step
    const top = currentMin * PIXELS_PER_MINUTE
    const isHourLine = currentMin % 60 === 0
    return (
      <div
        key={`line-${i}`}
        className={`absolute w-full border-t pointer-events-none ${isHourLine ? 'border-muted-foreground/50' : 'border-muted-foreground/25 border-dashed'}`}
        style={{ top }}
      />
    )
  })

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Scrollable container — the day-header row lives inside it (sticky-pinned)
          so both the header and the grid body divide the exact same available
          width into 7 columns; no more guessing at the browser's scrollbar width. */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Day header row — sticky to top of the scroll view */}
        <div className="flex border-b border-border sticky top-0 z-20 bg-card">
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

        <div className="flex" style={{ height: CONTAINER_HEIGHT }}>
          <div className="w-16 shrink-0 border-r border-border bg-card relative z-10">
            {HOURS.map((h) => (
              <div key={h} className="absolute px-2 text-right text-xs text-muted-foreground font-medium w-full" style={{ top: (h - START_HOUR) * 60 * PIXELS_PER_MINUTE + 12 }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          <div className="flex-1 grid grid-cols-7 relative" style={{ height: CONTAINER_HEIGHT }}>
            {days.map((d) => {
              const isToday = d.toDateString() === todayKey
              const dayAppointments = appointmentsOnDay(appointments, d)
              return (
                <div key={d.toDateString()} className="relative border-r last:border-r-0 border-border/80">
                  {timeLines}

                  {/* Empty-space click jumps to Day view, same as the real WeekView.tsx */}
                  <div className="absolute inset-0 z-[1] cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => onDayClick(d)} />

                  {isToday && nowPixels > 0 && nowPixels < CONTAINER_HEIGHT && (
                    <div className="absolute w-full z-20 pointer-events-none" style={{ top: nowPixels }}>
                      <div className="h-2 w-2 bg-red-500 rounded-full absolute -left-1 -top-1" />
                      <div className="w-full border-t-[2px] border-red-500" />
                    </div>
                  )}

                  {dayAppointments.map((a) => {
                    const start = new Date(a.startISO)
                    const end = new Date(a.endISO)
                    const top = (start.getHours() * 60 + start.getMinutes() - START_HOUR * 60) * PIXELS_PER_MINUTE
                    const height = Math.max(24, ((end.getTime() - start.getTime()) / 60_000) * PIXELS_PER_MINUTE)
                    const master = masters.find((m) => m.id === a.masterId)
                    const color = MASTER_COLORS[a.masterId] ?? '#8B4A58'
                    return (
                      <div
                        key={a.id}
                        onClick={(e) => { e.stopPropagation(); onAppointmentClick(a) }}
                        className="absolute w-[calc(100%-8px)] rounded-md p-1 text-xs overflow-hidden hover:z-30 hover:shadow-md hover:ring-2 ring-primary/40 transition-all text-foreground cursor-pointer"
                        style={{ top, minHeight: height, left: 4, zIndex: 10, backgroundColor: color + '26', borderLeft: `3px solid ${color}` }}
                      >
                        <div className="font-semibold leading-tight truncate">{a.clientName}</div>
                        <div className="opacity-90 leading-tight truncate mt-0.5">{a.procedureName}</div>
                        <div className="opacity-75 leading-tight text-[10px] mt-0.5 truncate">
                          {master?.name} · {formatTime(a.startISO)}
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
    </div>
  )
}
