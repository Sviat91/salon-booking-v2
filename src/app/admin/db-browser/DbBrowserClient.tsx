"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

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

  const fetchData = useCallback(async (table: TableName, p: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/db-browser/${table}?page=${p}&pageSize=50`)
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to load")
      }
      const d: BrowseResult = await res.json()
      setData(d)
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

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const columns = data?.rows[0] ? Object.keys(data.rows[0]) : []

  return (
    <div className="flex h-full gap-0">
      {/* Sidebar */}
      <aside className="w-48 shrink-0 border-r border-border bg-muted/30 p-3">
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground tracking-wide">Tables</p>
        <ul className="space-y-0.5">
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
      <div className="flex-1 min-w-0 flex flex-col p-4 gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{selectedTable}</h1>
            {data && (
              <p className="text-xs text-muted-foreground mt-0.5">{data.total} rows total</p>
            )}
          </div>
          <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-400">
            Read-only
          </span>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading…
          </div>
        )}

        {!loading && data && data.rows.length === 0 && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            No rows in this table.
          </div>
        )}

        {!loading && data && data.rows.length > 0 && (
          <>
            <div className="rounded-xl border border-border overflow-auto flex-1">
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
                            className="px-3 py-1.5 max-w-[200px] truncate text-foreground"
                            title={display}
                          >
                            {display}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
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
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
