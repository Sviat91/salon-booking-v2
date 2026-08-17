import { useState } from 'react'
import { Search, Pencil, User } from 'lucide-react'
import AdminCard from '../../AdminCard'
import Badge from '../../../components/ui/badge'
import Dialog from '../../shared/Dialog'

type ClientRow = {
  id: string
  name: string
  phone: string
  email: string | null
  registered: string
  isGuest: boolean
}

// Invented rows — reuses two names already established in mockAdminData.ts
// appointments (Kasia Wiśniewska, Tomasz Nowicki), plus three new ones for
// variety, matching the real ClientsTable's row shape (User records with
// role CLIENT, isGuest = no password set).
const CLIENTS: ClientRow[] = [
  { id: 'c1', name: 'Kasia Wiśniewska', phone: '+48 601 111 222', email: 'kasia.wisniewska@gmail.com', registered: '2025-03-12', isGuest: false },
  { id: 'c2', name: 'Tomasz Nowicki', phone: '+48 601 234 567', email: 'tomasz.nowicki@gmail.com', registered: '2025-05-02', isGuest: true },
  { id: 'c3', name: 'Piotr Zieliński', phone: '+48 512 987 654', email: 'piotr.zielinski@wp.pl', registered: '2025-06-20', isGuest: false },
  { id: 'c4', name: 'Agnieszka Dąbrowska', phone: '+48 698 456 123', email: null, registered: '2025-07-08', isGuest: true },
  { id: 'c5', name: 'Michał Wójcik', phone: '+48 792 345 678', email: 'michal.wojcik@outlook.com', registered: '2025-08-01', isGuest: false },
]

const fieldClass = 'w-full h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed'

// Structural port of ClientsTable.tsx. Search is the one genuinely
// interactive piece (client-side filter over the mock rows above, matching
// the Calendar master-filter precedent). The edit Dialog and its fields stay
// inert, matching every other Sheet/Dialog in this admin demo.
export default function ClientsTab() {
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<ClientRow | null>(null)

  const filtered = CLIENTS.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q)
  })

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">{CLIENTS.length} clients total</p>

      <div className="mb-4 flex max-w-sm items-center gap-2 rounded-md border border-input bg-background px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, email…"
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No clients found.</p>
        </div>
      ) : (
        <AdminCard>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Phone</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Email</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Registered</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Type</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((client) => (
                <tr key={client.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 flex items-center gap-2">
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {client.name}
                  </td>
                  <td className="px-4 py-3">{client.phone}</td>
                  <td className="px-4 py-3">{client.email ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(client.registered).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    {client.isGuest ? <Badge variant="muted">Guest</Badge> : <Badge variant="success">Registered</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditTarget(client)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      )}

      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Client">
        {editTarget && (
          <div className="flex flex-col gap-4 pt-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Name</label>
              <input disabled defaultValue={editTarget.name} className={fieldClass} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Phone</label>
              <input disabled defaultValue={editTarget.phone} className={fieldClass} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Email</label>
              <input disabled defaultValue={editTarget.email ?? ''} className={fieldClass} />
            </div>
            <button
              onClick={() => setEditTarget(null)}
              className="h-10 w-fit rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Save Changes
            </button>
          </div>
        )}
      </Dialog>
    </div>
  )
}
