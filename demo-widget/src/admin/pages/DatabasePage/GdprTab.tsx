import { useState } from 'react'
import { Search } from 'lucide-react'
import AdminCard from '../../AdminCard'
import Badge from '../../../components/ui/badge'
import Dialog from '../../shared/Dialog'

type ConsentStatus = 'Active' | 'Withdrawn' | 'Erased'

type ConsentRow = {
  id: string
  name: string
  phoneDigits: string
  consentDate: string
  status: ConsentStatus
}

// Matches the same 4 mock clients used in ClientsTab where sensible (real
// ConsentRecord rows are keyed to the same User accounts). Statuses vary to
// show all 3 badge states.
const RECORDS: ConsentRow[] = [
  { id: 'g1', name: 'Kasia Wiśniewska', phoneDigits: '48601111222', consentDate: '2025-03-12', status: 'Active' },
  { id: 'g2', name: 'Tomasz Nowicki', phoneDigits: '48601234567', consentDate: '2025-05-02', status: 'Withdrawn' },
  { id: 'g3', name: 'Piotr Zieliński', phoneDigits: '48512987654', consentDate: '2025-06-20', status: 'Active' },
  { id: 'g4', name: 'Agnieszka Dąbrowska', phoneDigits: '48698456123', consentDate: '2025-07-08', status: 'Erased' },
]

function StatusBadge({ status }: { status: ConsentStatus }) {
  if (status === 'Active') return <Badge variant="success">Active</Badge>
  if (status === 'Withdrawn') return <Badge variant="warning">Withdrawn</Badge>
  return <Badge variant="muted">Erased</Badge>
}

type ConfirmAction = { kind: 'withdraw' | 'erase'; record: ConsentRow }

// Structural port of GdprTable.tsx. Search is the one interactive piece
// (client-side filter, matching the Clients tab / Calendar master-filter
// precedent). Withdraw/Erase reuse the shared Dialog as a confirm prompt —
// Confirm just closes the dialog, no row state actually changes.
export default function GdprTab() {
  const [search, setSearch] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  const filtered = RECORDS.filter((r) => (search ? r.name.toLowerCase().includes(search.toLowerCase()) : true))

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">{RECORDS.length} consent records total</p>

      <div className="mb-4 flex max-w-sm items-center gap-2 rounded-md border border-input bg-background px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No records found.</p>
        </div>
      ) : (
        <AdminCard>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Phone</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Consent Date</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((record) => {
                const maskedPhone = '****' + record.phoneDigits.slice(-4)
                return (
                  <tr key={record.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">{record.name}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{maskedPhone}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(record.consentDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {record.status === 'Active' && (
                          <button
                            onClick={() => setConfirmAction({ kind: 'withdraw', record })}
                            className="h-8 rounded-md border border-input px-3 text-xs font-medium hover:bg-muted transition-colors"
                          >
                            Withdraw
                          </button>
                        )}
                        {record.status !== 'Erased' && (
                          <button
                            onClick={() => setConfirmAction({ kind: 'erase', record })}
                            className="h-8 rounded-md border border-input px-3 text-xs font-medium hover:bg-muted hover:text-destructive hover:border-destructive transition-colors"
                          >
                            Erase
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </AdminCard>
      )}

      <Dialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.kind === 'erase' ? 'Erase Client Data' : 'Withdraw Consent'}
      >
        {confirmAction && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {confirmAction.kind === 'erase'
                ? `PERMANENTLY ERASE all personal data for "${confirmAction.record.name}"? This anonymizes the consent record and linked user account. This action CANNOT be undone.`
                : `Withdraw consent for "${confirmAction.record.name}"? This cannot be undone.`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="h-9 rounded-md border border-input bg-transparent px-4 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                {confirmAction.kind === 'erase' ? 'Erase' : 'Withdraw'}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
