import { ReactNode } from "react"
import AdminSidebar from "@/components/admin/AdminSidebar"
import AdminTopBar from "@/components/admin/AdminTopBar"
import { getTenantConfig } from "@/lib/tenant"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const config = await getTenantConfig()

  return (
    // admin-layout: solid bg covers the public site radial gradient
    <div className="admin-layout flex h-screen overflow-hidden bg-background text-foreground">
      <AdminSidebar brandName={config.brandName} logoUrl={config.logoUrl ?? null} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AdminTopBar />
        <main className="flex-1 overflow-y-auto bg-background">
          {/* 240px = AdminSidebar.tsx's expanded width (w-60). Deliberately a constant,
              not the sidebar's live/current width, so this container's computed width
              stays identical whether the sidebar is expanded or collapsed. Keep in sync
              if AdminSidebar.tsx's w-60 ever changes. */}
          <div className="mx-auto w-[calc(100vw-240px)] max-w-full px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
