import type { ReactNode } from 'react'

// Shared card wrapper for the Settings-family pages (Email, Social Auth,
// Notifications, Booking bot, Legal Documents) — mirrors the local `Section`
// component already used in SettingsPage/index.tsx exactly, so every
// Settings-family page shares one card convention instead of inventing a
// new one.
export default function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="bg-card border border-border rounded-[20px] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-6 p-6">{children}</div>
    </section>
  )
}
