import { Calendar as CalIcon, User, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { MockAppointment } from '../../mockAdminData'

interface AppointmentModalProps {
  mode: 'create' | 'edit' | 'copy'
  date?: Date
  appointment?: MockAppointment
  masters: { id: string; name: string; color: string }[]
  onClose: () => void
}

const fieldClass = 'w-full h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

// Simplified structural port of the real AppointmentModal.tsx create/edit
// form shell. The real component wires live client/service/master lookups,
// duration-aware availability fetching, and multi-entry "add another date"
// series — none of that has a backend here. Every field is shown with its
// real label and a plausible prefilled/placeholder value but is disabled
// (matches the inert-field convention already used for Settings' read-only
// cards); Save closes the modal only, no mock data is ever written.
export default function AppointmentModal({ mode, date, appointment, masters, onClose }: AppointmentModalProps) {
  const master = masters.find((m) => m.id === appointment?.masterId)
  const isoDate = (appointment ? new Date(appointment.startISO) : date) ?? new Date()
  const dateValue = isoDate.toISOString().slice(0, 10)
  const timeValue = appointment ? new Date(appointment.startISO).toTimeString().slice(0, 5) : '10:00'
  const durationValue = appointment ? Math.round((new Date(appointment.endISO).getTime() - new Date(appointment.startISO).getTime()) / 60_000) : 60

  const title = mode === 'edit' ? 'Edit Booking' : mode === 'copy' ? 'Duplicate Booking' : 'New Booking'
  const subtitle = mode === 'create' ? 'Create a manual booking for a client' : 'Manual booking details'

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/50 p-4">
      <div className="flex min-h-full items-center justify-center py-8">
        <div className="flex w-full max-w-3xl flex-col rounded-xl bg-background shadow-xl">
          <div className="flex items-center justify-between rounded-t-xl border-b border-border bg-card p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold leading-tight">{title}</h2>
                <p className="text-sm font-medium text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-8 p-6">
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <label className="mb-1.5 block text-sm font-medium">Assigned Master <span className="text-red-600">*</span></label>
              <select disabled defaultValue={master?.id ?? ''} className={fieldClass}>
                <option value="">Choose a master…</option>
                {masters.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <Field label="Service">
                <select disabled defaultValue={appointment?.procedureName ?? ''} className={fieldClass}>
                  <option value="">Select a service…</option>
                  {appointment && <option value={appointment.procedureName}>{appointment.procedureName}</option>}
                  <option value="__custom">Other / custom service</option>
                </select>
              </Field>

              <div className="space-y-3">
                <h3 className="flex items-center gap-2 border-b border-border pb-2 text-lg font-semibold">
                  <User className="h-4 w-4 text-primary" /> Client Details
                </h3>
                <Field label="Select existing client">
                  <select disabled defaultValue={appointment ? appointment.clientName : ''} className={fieldClass}>
                    <option value="">New client (guest)</option>
                    {appointment && <option value={appointment.clientName}>{appointment.clientName}{appointment.clientPhone ? ` (${appointment.clientPhone})` : ''}</option>}
                  </select>
                </Field>
                <Field label="Client name">
                  <input disabled defaultValue={appointment?.clientName ?? ''} placeholder="Guest full name" className={fieldClass} />
                </Field>
                <Field label="Phone number">
                  <input disabled defaultValue={appointment?.clientPhone ?? ''} placeholder="+48 000 000 000" className={fieldClass} />
                </Field>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="flex items-center gap-2 border-b border-border pb-2 text-lg font-semibold">
                <CalIcon className="h-4 w-4 text-primary" /> Schedule
              </h3>
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-nowrap">
                <Field label="Date">
                  <input disabled type="date" defaultValue={dateValue} className={fieldClass} />
                </Field>
                <Field label="Start time">
                  <input disabled type="time" defaultValue={timeValue} className={fieldClass} />
                </Field>
                <Field label="Duration (min)">
                  <input disabled type="number" defaultValue={durationValue} className={fieldClass} />
                </Field>
              </div>
            </div>

            <Field label="Notes (optional)">
              <textarea disabled defaultValue={appointment?.notes ?? ''} placeholder="Nothing to note" className="min-h-[80px] w-full resize-none rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed" />
            </Field>
          </div>

          <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-b-xl border-t border-border bg-card p-5">
            <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button onClick={onClose} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
              {mode === 'edit' ? 'Save Changes' : 'Create Appointment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
