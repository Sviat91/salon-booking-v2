"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

const tabs = [
  { labelKey: "admin.database.clientsTab", href: "/admin/database/clients" },
  { labelKey: "admin.database.gdprTab", href: "/admin/database/gdpr" },
]

export default function DatabaseSubNav() {
  const pathname = usePathname()
  const { t } = useTranslation()

  return (
    <div className="mb-6 flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            pathname.startsWith(tab.href)
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t(tab.labelKey)}
        </Link>
      ))}
    </div>
  )
}
