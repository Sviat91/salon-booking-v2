import { ReactNode } from "react"
import DatabaseSubNav from "./DatabaseSubNav"

export default function DatabaseLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Records</p>
        <p className="mt-1 text-sm text-muted-foreground">Manage clients and GDPR consent records.</p>
      </div>
      <DatabaseSubNav />
      {children}
    </div>
  )
}
