import { ReactNode } from "react"
import Header from "@/components/layout/Header"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <div className="flex-1 w-full mx-auto p-4 sm:p-8">
        {children}
      </div>
    </div>
  )
}
