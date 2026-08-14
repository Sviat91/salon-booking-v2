import type { StoredBooking } from '../../lib/localBookings'

interface ResultsPanelProps {
  results: StoredBooking[]
  fullName: string
  phone: string
  onBackToSearch: () => void
  onNewSearch: () => void
}

// Simplified from the real ResultsPanel.tsx: shows found bookings as static
// cards (name, master, date/time, price). The real panel also lets you
// select a booking to change its time/procedure or cancel it — that whole
// flow needs bookings that live in a real, mutable backend, which this demo
// intentionally doesn't have (see BookingManagement.tsx's comment), so the
// select/change/cancel interaction is dropped rather than faked.
export default function ResultsPanel({ results, fullName, phone, onBackToSearch, onNewSearch }: ResultsPanelProps) {
  return (
    <div className="overflow-y-auto space-y-4 pr-1">
      <div className="space-y-2">
        <div className="text-sm text-foreground font-medium">
          Found bookings for: <span className="text-primary">{fullName || 'unknown'}</span>, phone{' '}
          <span className="text-primary">{phone || 'unknown'}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Total: <strong>{results.length}</strong> {results.length === 1 ? 'booking' : 'bookings'}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card text-card-foreground p-4">
        <div className="space-y-3">
          {results.map((booking) => {
            const start = new Date(booking.startISO)
            const end = new Date(booking.endISO)
            const dateStr = start.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
            const fmtTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

            return (
              <div key={booking.id} className="rounded-xl border border-border bg-transparent text-foreground p-3">
                <div className="text-sm font-medium text-foreground">{booking.procedureName}</div>
                <div className="inline-flex items-center gap-1 text-xs font-medium text-primary/80 bg-primary/8 rounded-md px-1.5 py-0.5 mt-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {booking.masterName}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {dateStr} • {fmtTime(start)}–{fmtTime(end)}
                </div>
                <div className="text-xs text-muted-foreground">Price: {booking.price}zł</div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onBackToSearch} className="btn btn-outline flex-1">
          Back
        </button>
        <button type="button" onClick={onNewSearch} className="btn btn-primary flex-1">
          New search
        </button>
      </div>
    </div>
  )
}
