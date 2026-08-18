import { Menu, LogOut, ArrowLeft, ChevronRight, Scissors, Save } from 'lucide-react'
import { adminNavItems, type AdminSection } from './adminNavItems'
import AdminThemeToggle from './AdminThemeToggle'
import { useBrand } from '../context/BrandContext'
import { cn } from '../lib/utils'

interface AdminSidebarProps {
  section: AdminSection
  onNavigate: (section: AdminSection) => void
  open: boolean
  onToggleOpen: () => void
  onBackToSite: () => void
}

// Ported from the real AdminSidebar.tsx: w-60 expanded / w-[72px] collapsed,
// labels hidden entirely when collapsed (not just clipped), theme toggle +
// user block in the footer (not the topbar — matches the real split).
export default function AdminSidebar({ section, onNavigate, open, onToggleOpen, onBackToSite }: AdminSidebarProps) {
  const { brand, isDirty, saveDraft } = useBrand()
  return (
    <aside
      className={cn(
        'hidden lg:flex h-full flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-200 ease-out',
        open ? 'w-60' : 'w-[72px]'
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Scissors className="h-4 w-4" />
        </div>
        {open && <span className="truncate text-sm font-medium text-foreground">{brand.name}</span>}
        <button
          onClick={onToggleOpen}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            !open && 'mx-auto'
          )}
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {adminNavItems.map((item) => {
            const active = item.section === section
            const Icon = item.icon
            return (
              <li key={item.section}>
                <button
                  onClick={() => onNavigate(item.section)}
                  title={item.label}
                  className={cn(
                    'group flex w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-md py-2 text-sm font-medium transition-colors',
                    open ? 'px-3' : 'justify-center px-0',
                    active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {open && <span className="flex-1 text-left">{item.label}</span>}
                  {open && active && <ChevronRight className="h-3.5 w-3.5 text-primary" />}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-4 border-t border-border pt-4">
          <button
            onClick={onBackToSite}
            title="Back to site"
            className={cn(
              'group flex w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-md py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              open ? 'px-3' : 'justify-center px-0'
            )}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {open && <span>Back to site</span>}
          </button>
        </div>
      </nav>

      {/* Save button — only on settings page, sibling of <nav> (not inside
          its scrollable area) so it stays visible regardless of scroll
          position, matching real AdminSidebar.tsx. */}
      {section === 'settings' && (
        <div className="px-3 pb-2">
          <button
            onClick={saveDraft}
            disabled={!isDirty}
            title={!open ? 'Save changes' : undefined}
            className={cn(
              'flex w-full items-center gap-2 overflow-hidden whitespace-nowrap rounded-md py-2 text-sm font-medium transition-colors',
              open ? 'px-3' : 'justify-center px-0',
              isDirty ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground cursor-not-allowed opacity-50'
            )}
          >
            <Save className="h-4 w-4 shrink-0" />
            {open && 'Save changes'}
          </button>
        </div>
      )}

      <div className="border-t border-border px-3 py-3 space-y-2">
        <div className={cn('flex items-center gap-2', !open && 'justify-center')}>
          {open && (
            <div className="flex-1 min-w-0 rounded-md bg-muted/50 px-3 py-2">
              <p className="truncate text-xs font-medium text-foreground">Super Admin</p>
              <p className="text-xs text-muted-foreground">SUPERADMIN</p>
            </div>
          )}
          <AdminThemeToggle />
        </div>
        <button
          className={cn(
            'flex w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
            !open && 'justify-center px-0'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {open && 'Sign out'}
        </button>
      </div>
    </aside>
  )
}
