"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { AdminPermissions } from "@/lib/admin-permissions"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { localeFor } from "@/lib/i18n"

type ConsentRow = {
  id: string
  fullName: string
  phoneDigits: string
  email: string | null
  consentDate: Date
  consentWithdrawnDate: Date | null
  erasureDate: Date | null
  consentPrivacyV10: boolean
  userId: string | null
}

interface Props {
  records: ConsentRow[]
  permissions: AdminPermissions
}

function getStatus(record: ConsentRow) {
  if (record.erasureDate) return "Erased"
  if (record.consentWithdrawnDate) return "Withdrawn"
  return "Active"
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  if (status === "Active")
    return <Badge variant="success">{t('admin.gdpr.statusActive')}</Badge>
  if (status === "Withdrawn")
    return <Badge variant="warning">{t('admin.gdpr.statusWithdrawn')}</Badge>
  return <Badge variant="muted">{t('admin.gdpr.statusErased')}</Badge>
}

export default function GdprTable({ records, permissions }: Props) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState<string | null>(null)

  const filtered = records.filter((r) => {
    if (!search) return true
    return r.fullName.toLowerCase().includes(search.toLowerCase())
  })

  async function handleWithdraw(id: string, name: string) {
    if (!confirm(t('admin.gdpr.withdrawConfirm', { name }))) return
    setLoading(id + "-withdraw")
    const res = await fetch(`/api/admin/database/gdpr/${id}/withdraw`, { method: "POST" })
    setLoading(null)
    if (res.ok) router.refresh()
  }

  async function handleErase(id: string, name: string) {
    if (!confirm(t('admin.gdpr.eraseConfirm', { name })))
      return
    setLoading(id + "-erase")
    const res = await fetch(`/api/admin/database/gdpr/${id}/erase`, { method: "POST" })
    setLoading(null)
    if (res.ok) router.refresh()
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {t('admin.gdpr.totalRecords', { count: records.length })}
      </p>

      <div className="mb-4 flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          placeholder={t('admin.gdpr.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">{t('admin.gdpr.noRecordsFound')}</p>
        </div>
      ) : (
        <div className="rounded-[20px] border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.database.nameLabel')}</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('form.phone')}</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.gdpr.colConsentDate')}</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.appointments.colStatus')}</th>
                {(permissions.gdpr.withdraw || permissions.gdpr.erase) && (
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.services.colActions')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((record) => {
                const status = getStatus(record)
                const maskedPhone = "****" + record.phoneDigits.slice(-4)
                return (
                  <tr key={record.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">{record.fullName}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{maskedPhone}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(record.consentDate).toLocaleDateString(localeFor(language))}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={status} />
                    </td>
                    {(permissions.gdpr.withdraw || permissions.gdpr.erase) && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {permissions.gdpr.withdraw &&
                            !record.consentWithdrawnDate &&
                            !record.erasureDate && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={loading === record.id + "-withdraw"}
                                onClick={() => handleWithdraw(record.id, record.fullName)}
                              >
                                {loading === record.id + "-withdraw" ? "…" : t('admin.gdpr.withdrawBtn')}
                              </Button>
                            )}
                          {permissions.gdpr.erase && !record.erasureDate && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="hover:text-destructive hover:border-destructive"
                              disabled={loading === record.id + "-erase"}
                              onClick={() => handleErase(record.id, record.fullName)}
                            >
                              {loading === record.id + "-erase" ? "…" : t('admin.gdpr.eraseBtn')}
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
