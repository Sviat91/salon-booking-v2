import { Upload, User } from 'lucide-react'
import Sheet from '../shared/Sheet'
import { MASTER_COLORS } from '../mockAdminData'
import type { Master } from '../../types'

const fieldClass = 'w-full h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed'
const checkboxClass = 'h-4 w-4 accent-primary shrink-0 cursor-not-allowed'

// Invented — the real schema stores each master's login email on the User
// row; data.ts (shared with the public booking flow) has no email field, so
// this is a plausible admin-only value matching the brand domain already
// used elsewhere (SettingsPage's "hello@loomandblade.pl").
const MASTER_EMAILS: Record<string, string> = {
  marek: 'marek@loomandblade.pl',
  anna: 'anna@loomandblade.pl',
}

// Structural port of MasterForm.tsx (avatar/name/email/bio/color/visibility/
// footer block) + the "Manage pages" and Access Recovery blocks below it.
// Every field is disabled and prefilled with real mock data — nothing here
// uploads, saves, or decrypts anything.
export default function MasterEditSheet({ open, master, onClose }: { open: boolean; master: Master | null; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Edit Master">
      {master && (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Master Photo</label>
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-border bg-muted flex items-center justify-center">
                  {master.avatar ? (
                    <img src={master.avatar} alt={master.name} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground cursor-not-allowed">
                  <Upload className="h-4 w-4" />
                  Upload photo
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Full Name</label>
              <input disabled defaultValue={master.name} className={fieldClass} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <input disabled defaultValue={MASTER_EMAILS[master.id] ?? ''} className={fieldClass} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bio / Title</label>
              <input disabled defaultValue={master.title} maxLength={80} className={fieldClass} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Appointment Color</label>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 shrink-0 rounded-md border border-border" style={{ backgroundColor: MASTER_COLORS[master.id] ?? '#8B4A58' }} />
                <span className="text-sm text-muted-foreground">{MASTER_COLORS[master.id] ?? '#8B4A58'}</span>
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
              <input type="checkbox" disabled defaultChecked className={checkboxClass} />
              <div>
                <span className="block text-sm font-medium">Show on homepage</span>
                <span className="text-xs text-muted-foreground">Hidden masters can still be booked directly via their link.</span>
              </div>
            </label>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Footer Block</label>
              <p className="-mt-1 text-xs text-muted-foreground">Optional content shown at the bottom of this master's booking page.</p>
              <select disabled defaultValue="none" className={fieldClass}>
                <option value="none">None</option>
                <option value="photoWidget">Photo Widget</option>
                <option value="text">Text</option>
              </select>
            </div>

            <button
              onClick={onClose}
              className="mt-2 h-10 w-fit rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Save Changes
            </button>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-6">
            <button className="w-fit rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
              Manage pages
            </button>
            <p className="text-xs text-muted-foreground">Custom content pages shown only on this master's booking flow.</p>
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-6">
            <div>
              <h3 className="text-lg font-semibold">Access Recovery</h3>
              <p className="text-sm text-muted-foreground">View or reset this master's login password.</p>
            </div>

            <div className="grid gap-2 max-w-sm">
              <label className="text-sm font-medium">Current password</label>
              <button className="w-fit rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
                Show current password
              </button>
            </div>

            <div className="grid gap-2 max-w-sm">
              <label className="text-sm font-medium">New password</label>
              <div className="flex gap-2">
                <input disabled placeholder="Leave blank to auto-generate" className={fieldClass} />
                <button className="shrink-0 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
                  Generate
                </button>
              </div>
              <button className="mt-2 w-fit rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:opacity-90 transition-opacity">
                Save New Password
              </button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  )
}
