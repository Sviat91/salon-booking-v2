import {
  LayoutDashboard,
  CalendarDays,
  Scissors,
  Percent,
  Users,
  FileText,
  Settings,
  Mail,
  Key,
  Bell,
  Bot,
  ScrollText,
  Database,
  UserCog,
  Table2,
  type LucideIcon,
} from 'lucide-react'

export type AdminSection =
  | 'dashboard'
  | 'calendar'
  | 'services'
  | 'discounts'
  | 'masters'
  | 'pages'
  | 'settings'
  | 'email'
  | 'social'
  | 'notifications'
  | 'client-bot'
  | 'legal'
  | 'database'
  | 'admins'
  | 'db-browser'

export interface AdminNavItem {
  section: AdminSection
  label: string
  icon: LucideIcon
}

// Ported from the real adminNavItems.ts — SUPERADMIN role's full 15-item
// list (matches the reference screenshot's sidebar exactly).
export const adminNavItems: AdminNavItem[] = [
  { section: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'calendar', label: 'Calendar', icon: CalendarDays },
  { section: 'services', label: 'Services', icon: Scissors },
  { section: 'discounts', label: 'Discounts', icon: Percent },
  { section: 'masters', label: 'Masters', icon: Users },
  { section: 'pages', label: 'Pages', icon: FileText },
  { section: 'settings', label: 'Settings', icon: Settings },
  { section: 'email', label: 'Email', icon: Mail },
  { section: 'social', label: 'Social Auth', icon: Key },
  { section: 'notifications', label: 'Notifications', icon: Bell },
  { section: 'client-bot', label: 'Booking bot', icon: Bot },
  { section: 'legal', label: 'Legal Documents', icon: ScrollText },
  { section: 'database', label: 'Database', icon: Database },
  { section: 'admins', label: 'Admins', icon: UserCog },
  { section: 'db-browser', label: 'DB Browser', icon: Table2 },
]

export const sectionTitles: Record<AdminSection, string> = Object.fromEntries(
  adminNavItems.map((item) => [item.section, item.label])
) as Record<AdminSection, string>
