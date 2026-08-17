import Sheet from '../shared/Sheet'
import type { AdminRow } from './AdminsPage'

const fieldClass = 'w-full h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed'
const checkboxClass = 'h-4 w-4 accent-primary shrink-0 cursor-not-allowed'

const CLIENT_PERM_LABELS: { key: keyof AdminRow['perms']['clients']; label: string }[] = [
  { key: 'view', label: 'View' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
]

const GDPR_PERM_LABELS: { key: keyof AdminRow['perms']['gdpr']; label: string }[] = [
  { key: 'view', label: 'View' },
  { key: 'withdraw', label: 'Withdraw' },
  { key: 'erase', label: 'Erase' },
]

// Structural port of AdminForm.tsx. The real edit mode only shows the
// permission checklists (name/email/password only render in create mode) —
// this demo shows Full Name/Email/Password here too, per the plan's "fuller
// field set" instruction. Password has no real edit-mode equivalent, so it's
// shown disabled-and-empty with a "leave blank" placeholder rather than
// omitted, to keep the form visually complete like the rest of this admin's
// edit Sheets. Every field is disabled/inert; Save only closes the Sheet.
export default function AdminEditSheet({ open, admin, onClose }: { open: boolean; admin: AdminRow | null; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Edit Admin">
      {admin && (
        <div className="flex flex-col gap-6">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Full Name</label>
            <input disabled defaultValue={admin.name} className={fieldClass} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input disabled defaultValue={admin.email} className={fieldClass} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Password</label>
            <input disabled placeholder="Leave blank to keep current password" className={fieldClass} />
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium">Clients</p>
            {CLIENT_PERM_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-not-allowed">
                <input type="checkbox" disabled defaultChecked={admin.perms.clients[key]} className={checkboxClass} />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium">GDPR</p>
            {GDPR_PERM_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-not-allowed">
                <input type="checkbox" disabled defaultChecked={admin.perms.gdpr[key]} className={checkboxClass} />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={onClose}
            className="h-10 w-fit rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Save Permissions
          </button>
        </div>
      )}
    </Sheet>
  )
}
