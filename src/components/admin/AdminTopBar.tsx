"use client"

import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslation } from "react-i18next"
import { Search, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getPageTitleKey } from "@/components/admin/adminNavItems"

export default function AdminTopBar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { t } = useTranslation()
  const title = t(getPageTitleKey(pathname, session?.user?.role))
  const initial = (session?.user?.name ?? session?.user?.email ?? "?")
    .charAt(0)
    .toUpperCase()

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
      <h1 className="text-lg font-normal text-foreground">{title}</h1>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label={t('admin.common.searchAria')}>
          <Search className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" aria-label={t('admin.common.notificationsAria')}>
          <Bell className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Avatar>
          <AvatarFallback className="bg-primary text-primary-foreground">
            {initial}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
