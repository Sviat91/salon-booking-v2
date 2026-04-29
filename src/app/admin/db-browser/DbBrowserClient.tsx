"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react"

const TABLES = [
  "user",
  "masterProfile",
  "service",
  "masterService",
  "consentRecord",
  "schedule",
  "appointment",
  "dateOverride",
  "tenantConfig",
  "passwordResetToken",
  "account",
] as const

type TableName = (typeof TABLES)[number]

type BrowseResult = {
  rows: Record<string, unknown>[]
  total: number
  page: number
  pageSize: number
}

export default function DbBrowserClient() {
  const [selectedTable, setSelectedTable] = useState<TableName>("user")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<BrowseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchData = useCallback(async (table: TableName, p: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/db-browser/${table}?page=${p}&pageSize=50`)
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to load")
      }
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(selectedTable, page)
  }, [selectedTable, page, fetchData])

  function handleTableSelect(table: TableName) {
    setSelectedTable(table)
    setPage(1)
    setData(null)
  }

  async function handleDelete(id: unknown) {
    if (typeof id !== "string") return
    if (!confirm(`Delete row with id="${id}" from "${selectedTable}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/db-browser/${selectedTable}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "Delete failed")
      } else {
        fetchData(selectedTable, page)
      }
    } catch {
      setError("Delete failed")
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const columns = data?.rows[0] ? Object.keys(data.rows[0]) : []

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ minHeight: "calc(100vh - 10rem)" }}>
      <div className="flex h-full" style={{ minHeight: "calc(100vh - 10rem)" }}>
        {/* Table selector sidebar */}
        <aside className="w-44 shrink-0 border-r border-border bg-muted/30 flex flex-col">
          <div className="px-3 pt-4 pb-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Tables</p>
          </div>
          <ul className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
            {TABLES.map((t) => (
              <li key={t}>
                <button
                  onClick={() => handleTableSelect(t)}
                  className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                    selectedTable === t
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <h2 className="text-base font-semibold">{selectedTable}</h2>
              {data && (
                <p className="text-xs text-muted-foreground">{data.total} rows total</p>
              )}
            </div>
            <span className="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
              SUPERADMIN only
            </span>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-4">
            {error && (
              <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                Loading…
              </div>
            )}

            {!loading && data && data.rows.length === 0 && (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                No rows in this table.
              </div>
            )}

            {!loading && data && data.rows.length > 0 && (
              <div className="rounded-lg border border-border overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b border-border sticky top-0">
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                        {columns.map((col) => {
                          const val = row[col]
                          const display =
                            val === null || val === undefined
                              ? "—"
                              : val instanceof Date
                              ? (val as Date).toLocaleString()
                              : String(val)
                          return (
                            <td
                              key={col}
                              className="px-3 py-1.5 max-w-[180px] truncate text-foreground align-middle"
                              title={display}
                            >
                              {display}
                            </td>
                          )
                        })}
                        <td className="px-3 py-1.5 align-middle">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:text-destructive"
                            disabled={deletingId === String(row["id"])}
                            onClick={() => handleDelete(row["id"])}
                            title="Delete row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {data && data.total > data.pageSize && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
