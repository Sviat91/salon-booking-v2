"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { AdminPermissions } from "@/lib/admin-permissions"

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
  if (status === "Active")
    return <Badge variant="success">Active</Badge>
  if (status === "Withdrawn")
    return <Badge variant="warning">Withdrawn</Badge>
  return <Badge variant="muted">Erased</Badge>
}

export default function GdprTable({ records, permissions }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState<string | null>(null)

  const filtered = records.filter((r) => {
    if (!search) return true
    return r.fullName.toLowerCase().includes(search.toLowerCase())
  })

  async function handleWithdraw(id: string, name: string) {
    if (!confirm(`Withdraw consent for "${name}"? This cannot be undone.`)) return
    setLoading(id + "-withdraw")
    const res = await fetch(`/api/admin/database/gdpr/${id}/withdraw`, { method: "POST" })
    setLoading(null)
    if (res.ok) router.refresh()
  }

  async function handleErase(id: string, name: string) {
    if (
      !confirm(
        `PERMANENTLY ERASE all personal data for "${name}"?\n\nThis anonymizes the consent record and linked user account. This action CANNOT be undone.`
      )
    )
      return
    setLoading(id + "-erase")
    const res = await fetch(`/api/admin/database/gdpr/${id}/erase`, { method: "POST" })
    setLoading(null)
    if (res.ok) router.refresh()
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {records.length} consent record{records.length !== 1 ? "s" : ""} total
      </p>

      <div className="mb-4 flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No records found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Consent Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                {(permissions.gdpr.withdraw || permissions.gdpr.erase) && (
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((record, i) => {
                const status = getStatus(record)
                const maskedPhone = "****" + record.phoneDigits.slice(-4)
                return (
                  <tr key={record.id} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                    <td className="px-4 py-3">{record.fullName}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{maskedPhone}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(record.consentDate).toLocaleDateString()}
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
                                {loading === record.id + "-withdraw" ? "…" : "Withdraw"}
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
                              {loading === record.id + "-erase" ? "…" : "Erase"}
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
