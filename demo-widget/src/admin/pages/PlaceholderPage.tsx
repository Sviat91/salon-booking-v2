import type { LucideIcon } from 'lucide-react'
import AdminCard, { AdminSectionHeader } from '../AdminCard'

// Generic view-only stub for secondary admin sections (Email, Social Auth,
// Notifications, Booking bot, Legal Documents, Database, Admins, DB
// Browser) — clickable so nothing in the sidebar is a dead link, but not
// deeply mocked out like the primary business sections. Real UI, no fake
// data pretending to be real config/secrets.
export default function PlaceholderPage({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div>
      <AdminSectionHeader eyebrow={title} description={description} />
      <AdminCard className="flex flex-col items-center justify-center border-dashed py-16 text-center">
        <Icon className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">This screen is part of the real admin panel.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Not wired up in this demo — view-only.</p>
      </AdminCard>
    </div>
  )
}
