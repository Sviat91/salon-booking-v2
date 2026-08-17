import { MASTER_COLORS, type MockAppointment } from '../../mockAdminData'
import { appointmentsOnDay, monthGridDays } from './calendarUtils'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_DOTS = 3

interface MonthViewProps {
  currentDate: Date
  appointments: MockAppointment[]
  onDayClick: (d: Date) => void
}

// Simplified structural port of the real MonthView.tsx: 7-col header + 6-week
// (42-day) grid. The real component shows an expandable per-day appointment
// list and a live day-off/working-shift editor (both driven by
// template/override data this demo doesn't model — "Edit Schedule" stays
// inert with no mock schedule data at all, per the plan). Here each day just
// shows small master-colored dots for its mock appointments ("dotted per
// day", per the plan's own wording) and clicking any day jumps to Day view.
export default function MonthView({ currentDate, appointments, onDayClick }: MonthViewProps) {
  const days = monthGridDays(currentDate)
  const todayKey = new Date().toDateString()
  const currentMonth = currentDate.getMonth()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border shrink-0 bg-muted/20">
        {DAY_LABELS.map((label) => (
          <div key={label} className="py-2 text-center text-xs font-semibold text-muted-foreground border-r last:border-r-0 border-border">
            {label}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-y-auto min-h-0 bg-muted/10">
        {days.map((day) => {
          const isCurrentMonth = day.getMonth() === currentMonth
          const isToday = day.toDateString() === todayKey
          const dayAppointments = appointmentsOnDay(appointments, day)
          const dots = dayAppointments.slice(0, MAX_DOTS)
          const overflow = dayAppointments.length - dots.length

          return (
            <button
              key={day.toDateString()}
              onClick={() => onDayClick(day)}
              className={`border-b border-r border-border p-1.5 flex flex-col items-start text-left transition-colors hover:bg-muted/30 ${
                isCurrentMonth ? 'bg-card' : 'bg-muted/30 opacity-50'
              }`}
            >
              <span className={`text-sm flex items-center justify-center h-6 w-6 rounded-full font-medium ${isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                {day.getDate()}
              </span>

              {dayAppointments.length > 0 && (
                <div className="mt-auto flex items-center gap-1 pt-1">
                  {dots.map((a) => (
                    <span key={a.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: MASTER_COLORS[a.masterId] ?? '#8B4A58' }} />
                  ))}
                  {overflow > 0 && <span className="text-[10px] font-medium text-muted-foreground">+{overflow}</span>}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
