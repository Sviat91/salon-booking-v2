import { Users } from 'lucide-react'
import Sheet from '../shared/Sheet'
import { masters } from '../../data'

export type EditableService = {
  id: string
  name: string
  durationMin: number
  price: number
}

const fieldClass = 'w-full h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed'
const checkboxClass = 'h-4 w-4 accent-primary shrink-0 cursor-not-allowed'

// Structural port of the real ServiceForm.tsx shell. Every field is
// disabled/prefilled with the real service's data — matches the inert-field
// convention already used for Calendar's AppointmentModal. "Assign to
// Masters" is derived by matching the service name against each master's own
// service list in data.ts (the real MasterService join table equivalent).
export default function ServiceEditSheet({ open, service, onClose }: { open: boolean; service: EditableService | null; onClose: () => void }) {
  const assignments = masters.map((master) => ({
    master,
    offer: service ? master.services.find((s) => s.name === service.name) ?? null : null,
  }))

  return (
    <Sheet open={open} onClose={onClose} title={service ? 'Edit Service' : 'Add Service'}>
      {service && (
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Service Name</label>
            <input disabled defaultValue={service.name} placeholder="e.g. Classic Haircut" className={fieldClass} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Duration (minutes)</label>
            <input disabled type="number" defaultValue={service.durationMin} className={fieldClass} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Default Price</label>
            <input disabled type="number" defaultValue={service.price} placeholder="0.00" className={fieldClass} />
            <p className="text-xs text-muted-foreground">Used for any assigned master without a special price below.</p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Assign to Masters</span>
            </div>
            <p className="-mt-1 text-xs text-muted-foreground">Only assigned masters can be booked for this service.</p>
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {assignments.map(({ master, offer }) => (
                <div key={master.id} className="flex items-center gap-3 bg-background px-3 py-2.5">
                  <input type="checkbox" disabled defaultChecked={!!offer} className={checkboxClass} />
                  <span className="flex-1 text-sm font-medium">{master.name}</span>
                  {offer && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Price</span>
                      <input
                        disabled
                        defaultValue={offer.price.toFixed(2)}
                        className="h-7 w-20 rounded-md border border-input bg-muted/30 px-2 text-xs text-muted-foreground cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-2 h-10 w-fit rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Save Changes
          </button>
        </div>
      )}
    </Sheet>
  )
}
