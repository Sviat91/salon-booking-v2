import { ReactNode } from "react"
import AdminSidebar from "@/components/admin/AdminSidebar"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    // admin-layout: solid bg covers the public site radial gradient
    <div className="admin-layout flex h-screen overflow-hidden bg-background text-foreground">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
