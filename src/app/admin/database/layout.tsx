import { ReactNode } from "react"
import DatabaseSubNav from "./DatabaseSubNav"
import { getServerT } from "@/lib/i18n-server"

export default function DatabaseLayout({ children }: { children: ReactNode }) {
  const t = getServerT()
  return (
    <div>
      <div className="mb-2">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">{t('admin.database.recordsEyebrow')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('admin.database.recordsDesc')}</p>
      </div>
      <DatabaseSubNav />
      {children}
    </div>
  )
}
