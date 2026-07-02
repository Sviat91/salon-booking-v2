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
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  exact?: boolean
}

export const adminNavItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Calendar",
    href: "/admin/calendar",
    icon: CalendarDays,
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
    exact: true,
  },
  {
    label: "Email",
    href: "/admin/settings/email",
    icon: Mail,
  },
  {
    label: "Social Auth",
    href: "/admin/settings/social",
    icon: Key,
  },
  {
    label: "Notifications",
    href: "/admin/settings/notifications",
    icon: Bell,
  },
  {
    label: "Database",
    href: "/admin/database",
    icon: Database,
  },
]

export const superadminNavItems: NavItem[] = [
  ...adminNavItems,
  {
    label: "Admins",
    href: "/admin/admins",
    icon: UserCog,
  },
  {
    label: "DB Browser",
    href: "/admin/db-browser",
    icon: Table2,
  },
]

export const masterNavItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin/master",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Services",
    href: "/admin/master/services",
    icon: Scissors,
  },
  {
    label: "Schedule",
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

export function getPageTitle(pathname: string, role?: string): string {
  return (
    getNavItemsForRole(role).find((item) => isNavItemActive(item, pathname))
      ?.label ?? "Admin"
  )
}
