import {
  LayoutDashboard,
  Scissors,
  Users,
  Settings,
  CalendarDays,
  Mail,
  Key,
  Database,
  UserCog,
  Table2,
  Bell,
  Bot,
  FileText,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  labelKey: string
  href: string
  icon: LucideIcon
  exact?: boolean
}

export const adminNavItems: NavItem[] = [
  {
    labelKey: "admin.nav.dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    labelKey: "admin.nav.calendar",
    href: "/admin/calendar",
    icon: CalendarDays,
  },
  {
    labelKey: "admin.nav.services",
    href: "/admin/services",
    icon: Scissors,
  },
  {
    labelKey: "admin.nav.masters",
    href: "/admin/masters",
    icon: Users,
  },
  {
    labelKey: "admin.nav.pages",
    href: "/admin/pages",
    icon: FileText,
  },
  {
    labelKey: "admin.nav.settings",
    href: "/admin/settings",
    icon: Settings,
    exact: true,
  },
  {
    labelKey: "admin.nav.email",
    href: "/admin/settings/email",
    icon: Mail,
  },
  {
    labelKey: "admin.nav.socialAuth",
    href: "/admin/settings/social",
    icon: Key,
  },
  {
    labelKey: "admin.nav.notifications",
    href: "/admin/settings/notifications",
    icon: Bell,
  },
  {
    labelKey: "admin.nav.clientBot",
    href: "/admin/settings/client-bot",
    icon: Bot,
  },
  {
    labelKey: "admin.nav.database",
    href: "/admin/database",
    icon: Database,
  },
]

export const superadminNavItems: NavItem[] = [
  ...adminNavItems,
  {
    labelKey: "admin.nav.admins",
    href: "/admin/admins",
    icon: UserCog,
  },
  {
    labelKey: "admin.nav.dbBrowser",
    href: "/admin/db-browser",
    icon: Table2,
  },
]

export const masterNavItems: NavItem[] = [
  {
    labelKey: "admin.nav.dashboard",
    href: "/admin/master",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    labelKey: "admin.nav.services",
    href: "/admin/master/services",
    icon: Scissors,
  },
  {
    labelKey: "admin.nav.schedule",
    href: "/admin/master/schedule",
    icon: CalendarDays,
  },
]

export function getNavItemsForRole(role?: string): NavItem[] {
  if (role === "MASTER") return masterNavItems
  if (role === "SUPERADMIN") return superadminNavItems
  return adminNavItems
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href
  return pathname.startsWith(item.href)
}

export function getPageTitleKey(pathname: string, role?: string): string {
  return (
    getNavItemsForRole(role).find((item) => isNavItemActive(item, pathname))
      ?.labelKey ?? "admin.nav.fallbackTitle"
  )
}
