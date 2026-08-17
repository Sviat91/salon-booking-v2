import { AppProvider, useAppNavigation } from './context/AppContext'
import { BrandProvider } from './context/BrandContext'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import BookingPage from './pages/BookingPage'
import AboutPage from './pages/AboutPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import SupportPage from './pages/SupportPage'
import AdminApp from './admin/AdminApp'

// Ported from the real root layout.tsx shell: min-h-screen flex column with
// the page content flexing to fill and Footer pinned at the bottom. Admin
// has its own full-page chrome (sidebar/topbar, no public Footer), so it
// bypasses this shell entirely rather than being switched in like the other
// pages.
function Shell() {
  const { view } = useAppNavigation()

  if (view.name === 'admin') return <AdminApp />

  let page
  switch (view.name) {
    case 'home':
      page = <HomePage />
      break
    case 'booking':
      page = <BookingPage />
      break
    case 'about':
      page = <AboutPage />
      break
    case 'privacy':
      page = <PrivacyPage />
      break
    case 'terms':
      page = <TermsPage />
      break
    case 'support':
      page = <SupportPage />
      break
  }

  return (
    <div className="min-h-screen flex flex-col text-foreground">
      <div className="flex-1 w-full mx-auto flex flex-col">{page}</div>
      <Footer />
      <DevSiteAdminSwitch />
    </div>
  )
}

// Not part of the ported UI — the real product has no visible link from the
// public site into /admin (it's a separate authenticated route). Kept
// permanently (not just for local testing, per 2026-08-14) so a visitor can
// reach the "Customize" admin demo from the "Booking site" one — once
// handed off, the landing page can still show them as two separate embedded
// windows too; this button is just how you get from one to the other within
// a single instance of the app.
function DevSiteAdminSwitch() {
  const { navigateToAdmin } = useAppNavigation()
  return (
    <button
      onClick={navigateToAdmin}
      className="fixed bottom-3 right-3 z-50 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur hover:text-foreground"
    >
      View admin demo →
    </button>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrandProvider>
        <Shell />
      </BrandProvider>
    </AppProvider>
  )
}
