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
import EmailPage from './pages/EmailPage'
import SocialAuthPage from './pages/SocialAuthPage'
import NotificationsPage from './pages/NotificationsPage'
import ClientBotPage from './pages/ClientBotPage'
import LegalDocumentsPage from './pages/LegalDocumentsPage'
import DatabasePage from './pages/DatabasePage'
import AdminsPage from './pages/AdminsPage'
import DbBrowserPage from './pages/DbBrowserPage'
import { useAppNavigation } from '../context/AppContext'

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
    case 'email':
      return <EmailPage />
    case 'social':
      return <SocialAuthPage />
    case 'notifications':
      return <NotificationsPage />
    case 'client-bot':
      return <ClientBotPage />
    case 'legal':
      return <LegalDocumentsPage />
    case 'database':
      return <DatabasePage />
    case 'admins':
      return <AdminsPage />
    case 'db-browser':
      return <DbBrowserPage />
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

