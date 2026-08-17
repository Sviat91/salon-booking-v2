import { useState } from 'react'
import { X } from 'lucide-react'
import AdminSidebar from './AdminSidebar'
import AdminTopBar from './AdminTopBar'
import { sectionTitles, type AdminSection } from './adminNavItems'
import DashboardPage from './pages/DashboardPage'
import CalendarPage from './pages/CalendarPage'
import ServicesPage from './pages/ServicesPage'
import DiscountsPage from './pages/DiscountsPage'
import MastersPage from './pages/MastersPage'
import PagesPage from './pages/PagesPage'
import SettingsPage from './pages/SettingsPage'
import PlaceholderPage from './pages/PlaceholderPage'
import { useAppNavigation } from '../context/AppContext'
import { Mail, Key, Bell, Bot, ScrollText, Database, UserCog, Table2 } from 'lucide-react'

const PLACEHOLDER_SECTIONS: Partial<Record<AdminSection, { icon: typeof Mail; description: string }>> = {
  email: { icon: Mail, description: 'SMTP configuration for booking confirmations and reminders.' },
  social: { icon: Key, description: 'OAuth providers for client login (Google, Apple, Telegram).' },
  notifications: { icon: Bell, description: 'Telegram notification recipients for new/changed bookings.' },
  'client-bot': { icon: Bot, description: 'Telegram bot configuration for client-facing booking.' },
  legal: { icon: ScrollText, description: 'Privacy Policy and Terms of Service content.' },
  database: { icon: Database, description: 'Database connection and backup status.' },
  admins: { icon: UserCog, description: 'Admin and superadmin accounts.' },
  'db-browser': { icon: Table2, description: 'Raw table browser for support/debugging.' },
}

function renderSection(section: AdminSection) {
  switch (section) {
    case 'dashboard':
      return <DashboardPage />
    case 'calendar':
      return <CalendarPage />
    case 'services':
      return <ServicesPage />
    case 'discounts':
      return <DiscountsPage />
    case 'masters':
      return <MastersPage />
    case 'pages':
      return <PagesPage />
    case 'settings':
      return <SettingsPage />
    default: {
      const p = PLACEHOLDER_SECTIONS[section]!
      return <PlaceholderPage icon={p.icon} title={sectionTitles[section]} description={p.description} />
    }
  }
}

// Ported from the real admin/layout.tsx shell (flex h-screen, sidebar +
// topbar + scrollable main). This demo uses local state for the active
// section instead of Next.js routing (single-page app, no real routes) and
// a plain max-w-6xl content wrapper instead of the real `calc(100vw-240px)`
// hack (that hack exists to avoid reflow against a route-persisted sidebar
// in a real multi-page app — not needed here).
export default function AdminApp() {
  const { navigateHome } = useAppNavigation()
  const [section, setSection] = useState<AdminSection>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function handleNavigate(next: AdminSection) {
    setSection(next)
    setMobileMenuOpen(false)
  }

  return (
    <div className="admin-layout flex h-screen overflow-hidden bg-background text-foreground">
      <AdminSidebar section={section} onNavigate={handleNavigate} open={sidebarOpen} onToggleOpen={() => setSidebarOpen((o) => !o)} onBackToSite={navigateHome} />

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-card">
            <button onClick={() => setMobileMenuOpen(false)} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
            <AdminSidebar section={section} onNavigate={handleNavigate} open={true} onToggleOpen={() => {}} onBackToSite={navigateHome} />
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AdminTopBar title={sectionTitles[section]} onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto w-full max-w-6xl px-4 lg:px-6 py-4 lg:py-8">{renderSection(section)}</div>
        </main>
      </div>
    </div>
  )
}

