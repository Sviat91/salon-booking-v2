import { useState } from 'react'
import AdminCard from '../../AdminCard'
import { adminMastersList, weekAppointments, type MockAppointment } from '../../mockAdminData'
import CalendarToolbar from './CalendarToolbar'
import MonthView from './MonthView'
import WeekView from './WeekView'
import DayView from './DayView'
import BulkSettingsModal from './BulkSettingsModal'
import AppointmentModal from './AppointmentModal'
import ViewAppointmentModal from './ViewAppointmentModal'
import { startOfWeek, type ViewType } from './calendarUtils'

type BookingModalState = { mode: 'create' | 'edit' | 'copy'; date?: Date; appointment?: MockAppointment } | null

// Ported from the real ModernCalendar.tsx orchestration — view state, master
// filter state, and the 3 modals it can open. Unlike the real component,
// there's no data fetching (mock data is always in memory) and no
// localStorage persistence of the last-used view. Only the view toggle,
// master filter, and modal open/close are genuinely functional per the
// plan; navigation (Today/prev/next) stays inert, always showing the
// current week/month/day, same as the original build.
export default function CalendarPage() {
  const [view, setView] = useState<ViewType>('Week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedMasterId, setSelectedMasterId] = useState('all')
  const [step, setStep] = useState(15)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [viewingAppointment, setViewingAppointment] = useState<MockAppointment | null>(null)
  const [bookingModal, setBookingModal] = useState<BookingModalState>(null)

  const appointments = selectedMasterId === 'all' ? weekAppointments : weekAppointments.filter((a) => a.masterId === selectedMasterId)

  const goToDay = (d: Date) => {
    setCurrentDate(d)
    setView('Day')
  }

  const headerLabel = (() => {
    if (view === 'Month') return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (view === 'Week') {
      const start = startOfWeek(currentDate)
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  })()
  const todayLabel = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' })

  return (
    <AdminCard className="flex h-[calc(100vh-10rem)] min-h-[560px] flex-col rounded-[20px]">
      <CalendarToolbar
        view={view}
        setView={setView}
        headerLabel={headerLabel}
        todayLabel={todayLabel}
        selectedMasterId={selectedMasterId}
        masters={adminMastersList}
        onMasterChange={setSelectedMasterId}
        onBulkClick={() => setShowBulkModal(true)}
        step={step}
        setStep={setStep}
      />

      <div className="min-h-0 flex-1">
        {view === 'Month' && (
          <MonthView currentDate={currentDate} appointments={appointments} onDayClick={goToDay} />
        )}
        {view === 'Week' && (
          <WeekView
            currentDate={currentDate}
            appointments={appointments}
            onAppointmentClick={setViewingAppointment}
            onDayClick={goToDay}
            step={step}
          />
        )}
        {view === 'Day' && (
          <DayView
            currentDate={currentDate}
            appointments={appointments}
            onAppointmentClick={setViewingAppointment}
            onAddClick={(d) => setBookingModal({ mode: 'create', date: d })}
            step={step}
          />
        )}
      </div>

      {showBulkModal && <BulkSettingsModal masters={adminMastersList} onClose={() => setShowBulkModal(false)} />}

      {bookingModal && (
        <AppointmentModal
          mode={bookingModal.mode}
          date={bookingModal.date}
          appointment={bookingModal.appointment}
          masters={adminMastersList}
          onClose={() => setBookingModal(null)}
        />
      )}

      {viewingAppointment && (
        <ViewAppointmentModal
          appointment={viewingAppointment}
          onClose={() => setViewingAppointment(null)}
          onEdit={(a) => { setViewingAppointment(null); setBookingModal({ mode: 'edit', appointment: a }) }}
          onDuplicate={(a) => { setViewingAppointment(null); setBookingModal({ mode: 'copy', appointment: a }) }}
        />
      )}
    </AdminCard>
  )
}
