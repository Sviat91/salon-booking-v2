"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  Scissors,
  LogOut,
  ArrowLeft,
  Save,
  Menu,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import {
  getNavItemsForRole,
  isNavItemActive,
  type NavItem,
} from "@/components/admin/adminNavItems"

interface AdminSidebarProps {
  brandName: string
  logoUrl: string | null
}

function NavLink({ item, open }: { item: NavItem; open: boolean }) {
  const pathname = usePathname()
  const { t } = useTranslation()
  const active = isNavItemActive(item, pathname)
  const Icon = item.icon
  const label = t(item.labelKey)
  return (
    <Link
      href={item.href}
      title={!open ? label : undefined}
      className={cn(
        "group flex items-center gap-3 overflow-hidden whitespace-nowrap rounded-md py-2 text-sm font-medium transition-colors",
        open ? "px-3" : "justify-center px-0",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      {open && <span className="truncate">{label}</span>}
      {open && active && (
        <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />
      )}
    </Link>
  )
}

export default function AdminSidebar({ brandName, logoUrl }: AdminSidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { t } = useTranslation()
  const [isDirty, setIsDirty] = useState(false)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const handler = (e: Event) => {
      setIsDirty((e as CustomEvent<{ isDirty: boolean }>).detail.isDirty)
    }
    document.addEventListener('settings-dirty', handler)
    return () => document.removeEventListener('settings-dirty', handler)
  }, [])

  const navItems = getNavItemsForRole(session?.user?.role)

  return (
    <aside
      className={cn(
        "flex h-full flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-200 ease-out",
        open ? "w-60" : "w-[72px]"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        {open && (
          logoUrl ? (
            <Link href="/" className="flex min-w-0 flex-1 items-center gap-2">
              <Image
                src={logoUrl}
                alt={brandName}
                width={120}
                height={36}
                className="h-9 w-auto object-contain"
              />
            </Link>
          ) : (
            <Link href="/" className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
                <Scissors className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="truncate font-semibold tracking-tight text-foreground text-sm">
                {brandName}
              </span>
            </Link>
          )
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={open ? undefined : t('admin.nav.expand')}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            !open && "mx-auto"
          )}
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.href}>
              <NavLink item={item} open={open} />
            </li>
          ))}
        </ul>

        {/* Back to site — never reuse isNavItemActive here, every path starts with "/" */}
        <div className="mt-4 border-t border-border pt-4">
          <Link
            href="/"
            title={!open ? t('admin.nav.backToSite') : undefined}
            className={cn(
              "group flex items-center gap-3 overflow-hidden whitespace-nowrap rounded-md py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              open ? "px-3" : "justify-center px-0"
            )}
          >
            <ArrowLeft className="h-4 w-4 shrink-0 transition-colors group-hover:text-foreground" />
            {open && t('admin.nav.backToSite')}
          </Link>
        </div>
      </nav>

      {/* Save button — only on settings page */}
      {pathname.startsWith('/admin/settings') && (
        <div className="px-3 pb-2">
          <button
            type="submit"
            form="settings-form"
            disabled={!isDirty}
            title={!open ? t('admin.nav.saveSettings') : undefined}
            className={cn(
              "flex w-full items-center gap-2 overflow-hidden whitespace-nowrap rounded-md py-2 text-sm font-medium transition-colors",
              open ? "px-3" : "justify-center px-0",
              isDirty
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground cursor-not-allowed opacity-50"
            )}
          >
            <Save className="h-4 w-4 shrink-0" />
            {open && t('admin.nav.saveSettings')}
          </button>
        </div>
      )}

      {/* User + controls */}
      <div className="border-t border-border px-3 py-3 space-y-2">
        {/* Theme toggle + user info row */}
        <div className={cn("flex items-center gap-2", !open && "justify-center")}>
          {open && (
            <div className="flex-1 min-w-0 rounded-md bg-muted/50 px-3 py-2">
              <p className="truncate text-xs font-medium text-foreground">
                {session?.user?.name ?? session?.user?.email}
              </p>
              <p className="text-xs text-muted-foreground">{session?.user?.role}</p>
            </div>
          )}
          <ThemeToggle />
        </div>
        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          title={!open ? t('admin.nav.signOut') : undefined}
          className={cn(
            "flex w-full items-center gap-2 overflow-hidden whitespace-nowrap rounded-md py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
            open ? "px-3" : "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {open && t('admin.nav.signOut')}
        </button>
      </div>
    </aside>
  )
}
