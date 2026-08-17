import { useState } from 'react'
import SubNav from '../../shared/SubNav'
import ClientsTab from './ClientsTab'
import GdprTab from './GdprTab'

type Tab = 'clients' | 'gdpr'

const TABS: { key: Tab; label: string }[] = [
  { key: 'clients', label: 'Clients' },
  { key: 'gdpr', label: 'GDPR' },
]

// Structural port of database/layout.tsx + DatabaseSubNav.tsx. The real app
// uses actual Next.js routes for the two tabs (/admin/database/clients,
// /admin/database/gdpr) — this is a single-page demo, so the tab switch is
// local component state instead (per plan section 13, explicitly approved).
export default function DatabasePage() {
  const [tab, setTab] = useState<Tab>('clients')

  return (
    <div>
      <div className="mb-2">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Records</p>
        <p className="mt-1 text-sm text-muted-foreground">Manage clients and GDPR consent records.</p>
      </div>
      <SubNav tabs={TABS} active={tab} onChange={(key) => setTab(key as Tab)} />
      {tab === 'clients' ? <ClientsTab /> : <GdprTab />}
    </div>
  )
}
