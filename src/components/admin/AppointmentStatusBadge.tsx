"use client"

import { useTranslation } from "react-i18next"
import { Badge, type badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

function getStatusMeta(status: string, t: (key: string) => string): { variant: BadgeVariant; label: string; dotClass: string } {
  if (status === "PENDING") {
    return { variant: "warning", label: t("profile.statusPending"), dotClass: "bg-[var(--md-tertiary)]" }
  }
  if (status === "CONFIRMED") {
    return { variant: "success", label: t("profile.statusConfirmed"), dotClass: "bg-[var(--md-success)]" }
  }
  if (status.startsWith("CANCELLED")) {
    return { variant: "destructive", label: t("profile.statusCancelled"), dotClass: "bg-[var(--md-error)]" }
  }
  return { variant: "muted", label: status, dotClass: "bg-muted-foreground" }
}

export default function AppointmentStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const { variant, label, dotClass } = getStatusMeta(status, t)

  return (
    <Badge variant={variant} className="gap-1.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      {label}
    </Badge>
  )
}
