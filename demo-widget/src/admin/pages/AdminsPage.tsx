import { useState } from 'react'
import { Plus, Pencil, Trash2, Mail } from 'lucide-react'
import Badge from '../../components/ui/badge'
import AdminEditSheet from './AdminEditSheet'

export type AdminRow = {
  id: string
  name: string
  email: string
  perms: {
    clients: { view: boolean; edit: boolean; delete: boolean }
    gdpr: { view: boolean; withdraw: boolean; erase: boolean }
  }
}

// Two invented admins: the current SUPERADMIN (matches AdminSidebar's "Super
// Admin" footer label, all 6 permissions granted) and a second, invented
// ADMIN account with a partial permission set for visual variety.
const ADMINS: AdminRow[] = [
  {
    id: 'a1',
    name: 'Super Admin',
    email: 'superadmin@loomandblade.pl',
    perms: {
      clients: { view: true, edit: true, delete: true },
      gdpr: { view: true, withdraw: true, erase: true },
    },
  },
  {
    id: 'a2',
    name: 'Ewa Kowalczyk',
    email: 'ewa.kowalczyk@loomandblade.pl',
    perms: {
      clients: { view: true, edit: true, delete: false },
      gdpr: { view: true, withdraw: false, erase: false },
    },
  },
]

function PermBadge({ label, granted }: { label: string; granted: boolean }) {
  return (
    <Badge variant={granted ? 'success' : 'muted'} className="text-[10px]">
      {label}
    </Badge>
  )
}

// Structural port of AdminsClient.tsx — flex-card list, same family as
// MastersPage. Edit/Delete icon buttons and "Add Admin" are present for
// visual fidelity but inert; Edit opens the AdminEditSheet below.
export default function AdminsPage() {
  const [editTarget, setEditTarget] = useState<AdminRow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Access</p>
          <p className="mt-1 text-sm text-muted-foreground">{ADMINS.length} admins registered</p>
        </div>
        <button className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" />
          Add Admin
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {ADMINS.map((admin) => (
          <div key={admin.id} className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{admin.name}</p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{admin.email}</span>
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => {
                    setEditTarget(admin)
                    setSheetOpen(true)
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1 border-t border-border pt-2">
              <PermBadge label="Clients: View" granted={admin.perms.clients.view} />
              <PermBadge label="Clients: Edit" granted={admin.perms.clients.edit} />
              <PermBadge label="Clients: Delete" granted={admin.perms.clients.delete} />
              <PermBadge label="GDPR: View" granted={admin.perms.gdpr.view} />
              <PermBadge label="GDPR: Withdraw" granted={admin.perms.gdpr.withdraw} />
              <PermBadge label="GDPR: Erase" granted={admin.perms.gdpr.erase} />
            </div>
          </div>
        ))}
      </div>

      <AdminEditSheet open={sheetOpen} admin={editTarget} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
