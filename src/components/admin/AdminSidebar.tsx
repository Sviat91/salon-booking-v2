"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Scissors,
  Users,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/ui/theme-toggle"

const navItems = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Services",
    href: "/admin/services",
    icon: Scissors,
  },
  {
    label: "Masters",
    href: "/admin/masters",
    icon: Users,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  function isActive(item: (typeof navItems)[number]) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-card">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Scissors className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="font-semibold tracking-tight text-foreground">
          Admin Panel
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {item.label}
                  {active && (
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User + controls */}
      <div className="border-t border-border px-3 py-3 space-y-2">
        {/* Theme toggle + user info row */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-md bg-muted/50 px-3 py-2">
            <p className="truncate text-xs font-medium text-foreground">
              {session?.user?.name ?? session?.user?.email}
            </p>
            <p className="text-xs text-muted-foreground">{session?.user?.role}</p>
          </div>
          <ThemeToggle />
        </div>
        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
