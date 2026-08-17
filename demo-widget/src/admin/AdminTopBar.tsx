import { Menu, Search, Bell } from 'lucide-react'
import LanguageToggle from '../components/LanguageToggle'

// Ported from the real AdminTopBar.tsx. Note the theme toggle lives in the
// sidebar footer, not here. Search/bell are decorative — no admin data to
// search or notifications to show in a static demo.
export default function AdminTopBar({ title, onOpenMobileMenu }: { title: string; onOpenMobileMenu: () => void }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <button onClick={onOpenMobileMenu} className="flex h-9 w-9 items-center justify-center rounded-md lg:hidden">
          <Menu className="h-4 w-4 text-foreground" />
        </button>
        <h1 className="text-lg font-normal text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-1">
        <LanguageToggle />
        <button className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          <Search className="h-4 w-4" />
        </button>
        <button className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          <Bell className="h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
          S
        </div>
      </div>
    </header>
  )
}
