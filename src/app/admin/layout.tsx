import { ReactNode } from "react"
import AdminSidebar from "@/components/admin/AdminSidebar"
import { getTenantConfig } from "@/lib/tenant"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const config = await getTenantConfig()

  return (
    // admin-layout: solid bg covers the public site radial gradient
    <div className="admin-layout flex h-screen overflow-hidden bg-background text-foreground">
      <AdminSidebar brandName={config.brandName} logoUrl={config.logoUrl ?? null} />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
