import { useState } from 'react'
import { Calendar, Clock, Copy, Edit3, FileText, Phone, Scissors, Trash2, User, X } from 'lucide-react'
import { masters } from '../../../data'
import type { MockAppointment } from '../../mockAdminData'
import { formatTime, statusLabel } from './calendarUtils'

interface ViewAppointmentModalProps {
  appointment: MockAppointment
  onClose: () => void
  onEdit: (a: MockAppointment) => void
  onDuplicate: (a: MockAppointment) => void
}

function formatPln(n: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n)
}

// Structural port of the real ViewAppointmentModal.tsx. Edit/Duplicate open
// AppointmentModal pre-filled (still fully inert — nothing saves); Delete
// opens the same inline confirm-dialog pattern as the real component, whose
// Delete button just closes everything (no mock data is ever removed).
export default function ViewAppointmentModal({ appointment: a, onClose, onEdit, onDuplicate }: ViewAppointmentModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const master = masters.find((m) => m.id === a.masterId)
  const apptDate = new Date(a.startISO)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-background shadow-xl">
        <div className="flex items-start justify-between border-b border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">Booking Details</h2>
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{statusLabel(a.status)}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/20 text-primary">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Client</p>
                <p className="text-lg font-semibold">{a.clientName}</p>
              </div>
            </div>
            {a.clientPhone && (
              <div className="flex items-center gap-3 pl-11 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" /> {a.clientPhone}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 rounded-lg border border-border bg-muted/20 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> Date</p>
              <p className="font-semibold">{apptDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
            <div className="space-y-1 rounded-lg border border-border bg-muted/20 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Time</p>
              <p className="font-semibold">{formatTime(a.startISO)} - {formatTime(a.endISO)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Scissors className="h-3.5 w-3.5" /> Service</p>
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold">{a.procedureName}</p>
              <p className="font-bold text-primary">{formatPln(a.price)}</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">with {master?.name}</p>
            {a.discountPercent && (
              <div className="mt-1.5 text-xs text-muted-foreground">
                <p>{a.discountLabel ? `${a.discountLabel} discount applied (-${a.discountPercent}%)` : `Discount applied (-${a.discountPercent}%)`}</p>
                {a.originalPrice && a.originalPrice > a.price && <p>Original price: {formatPln(a.originalPrice)}</p>}
              </div>
            )}
          </div>

          {a.notes && (
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Notes</p>
              <p className="whitespace-pre-wrap text-sm">{a.notes}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border bg-muted/10 p-5 sm:flex-nowrap">
          <button onClick={() => onEdit(a)} className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <Edit3 className="h-4 w-4" /> Edit
          </button>
          <button onClick={() => onDuplicate(a)} className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <Copy className="h-4 w-4" /> Duplicate
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-background p-6 shadow-xl">
            <h3 className="text-lg font-bold">Delete booking?</h3>
            <p className="text-sm text-muted-foreground">This will permanently remove the appointment. This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={onClose} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
