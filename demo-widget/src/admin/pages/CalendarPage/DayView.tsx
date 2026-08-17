import { Clock, Phone, Plus, Scissors, User } from 'lucide-react'
import { masters } from '../../../data'
import { MASTER_COLORS, type MockAppointment } from '../../mockAdminData'
import { PIXELS_PER_MINUTE, appointmentsOnDay, formatTime, statusLabel } from './calendarUtils'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const CONTAINER_HEIGHT = 24 * 60 * PIXELS_PER_MINUTE

interface DayViewProps {
  currentDate: Date
  appointments: MockAppointment[]
  onAppointmentClick: (a: MockAppointment) => void
  onAddClick: (d: Date) => void
}

// Structural port of the real DayView.tsx: same absolute-positioned
// 1.5px/minute hour grid as WeekView, single column, richer appointment
// cards (client/service/phone/status). Day-off/shift-editing chrome from the
// source is dropped (no schedule mock data — same reasoning as WeekView).
// "+ New Booking" opens AppointmentModal in create mode, matching the real
// onAddClick wiring; clicking empty grid space does too (plan explicitly
// allows either affordance).
export default function DayView({ currentDate, appointments, onAppointmentClick, onAddClick }: DayViewProps) {
  const dayAppointments = appointmentsOnDay(appointments, currentDate)
  const isToday = currentDate.toDateString() === new Date().toDateString()
  const isPast = currentDate < new Date(new Date().setHours(0, 0, 0, 0))
  const now = new Date()
  const nowPixels = (now.getHours() * 60 + now.getMinutes()) * PIXELS_PER_MINUTE

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex border-b border-border shrink-0 bg-card pr-2">
        <div className="w-16 shrink-0 border-r border-border" />
        <div className="flex-1 py-3 px-4 flex items-center justify-between">
          <div className="flex flex-col items-start">
            <span className={`text-xs font-medium uppercase tracking-wider ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
              {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
            </span>
            <span className={`text-2xl font-bold mt-1 ${isToday ? 'text-primary' : ''}`}>
              {currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </span>
          </div>

          {!isPast && (
            <button
              onClick={() => onAddClick(currentDate)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> New Booking
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <div className="flex" style={{ height: CONTAINER_HEIGHT }}>
          <div className="w-16 shrink-0 border-r border-border bg-card relative z-10">
            {HOURS.map((h) => (
              <div key={h} className="absolute px-2 text-right text-sm text-muted-foreground font-medium w-full" style={{ top: h * 60 * PIXELS_PER_MINUTE + 12 }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          <div className="flex-1 relative">
            {HOURS.map((h) => (
              <div key={h} className="absolute w-full border-t border-border/60 pointer-events-none" style={{ top: h * 60 * PIXELS_PER_MINUTE }} />
            ))}

            <div className="absolute inset-0 z-[1] cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => !isPast && onAddClick(currentDate)} />

            {isToday && nowPixels > 0 && nowPixels < CONTAINER_HEIGHT && (
              <div className="absolute w-full z-20 pointer-events-none" style={{ top: nowPixels }}>
                <div className="h-3 w-3 bg-red-500 rounded-full absolute -left-1.5 -top-1.5" />
                <div className="w-full border-t-2 border-red-500" />
              </div>
            )}

            {dayAppointments.map((a) => {
              const start = new Date(a.startISO)
              const end = new Date(a.endISO)
              const top = (start.getHours() * 60 + start.getMinutes()) * PIXELS_PER_MINUTE
              const height = Math.max(60, ((end.getTime() - start.getTime()) / 60_000) * PIXELS_PER_MINUTE)
              const master = masters.find((m) => m.id === a.masterId)
              const color = MASTER_COLORS[a.masterId] ?? '#8B4A58'
              return (
                <div
                  key={a.id}
                  onClick={(e) => { e.stopPropagation(); onAppointmentClick(a) }}
                  className="absolute w-[calc(100%-30px)] rounded-lg text-foreground p-3 shadow-md border-l-[3px] overflow-hidden hover:z-30 hover:shadow-xl transition-all cursor-pointer flex gap-4"
                  style={{ top, minHeight: height, left: 8, zIndex: 10, backgroundColor: color + '26', borderLeftColor: color }}
                >
                  <div className="flex flex-col gap-1 w-[110px] sm:w-[150px] shrink-0 border-r border-foreground/10 pr-2 sm:pr-4">
                    <div className="font-bold text-lg">{formatTime(a.startISO)}</div>
                    <div className="text-sm opacity-70">{formatTime(a.endISO)}</div>
                    <div className="mt-auto text-xs font-semibold text-muted-foreground uppercase tracking-wider">{statusLabel(a.status)}</div>
                  </div>

                  <div className="flex-1 flex flex-col gap-2 min-w-0">
                    <h3 className="font-semibold text-base truncate flex items-center gap-2">
                      <User className="h-4 w-4 opacity-70" />
                      {a.clientName}
                    </h3>
                    <div className="flex items-center gap-2 sm:gap-4 text-sm opacity-90">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Scissors className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{a.procedureName}</span>
                      </div>
                      {a.clientPhone && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Phone className="h-3.5 w-3.5" />
                          {a.clientPhone}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs opacity-75">
                      <Clock className="h-3 w-3" /> {master?.name}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
