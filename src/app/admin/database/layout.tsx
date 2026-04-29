import { ReactNode } from "react"
import DatabaseSubNav from "./DatabaseSubNav"

export default function DatabaseLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Database</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage clients and GDPR consent records.</p>
      </div>
      <DatabaseSubNav />
      {children}
    </div>
  )
}
