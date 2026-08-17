import { useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import Badge from '../../../components/ui/badge'
import Dialog from '../../shared/Dialog'
import { TABLES, MOCK_ROWS, type TableName, type DbRow } from './mockDbData'

const PAGE_SIZE = 5

// Structural port of DbBrowserClient.tsx. The real page fetches
// `/api/admin/db-browser/[table]` per table/page; this demo has no backend,
// so table selection and pagination run over the local MOCK_ROWS instead —
// both are pure client-side state, matching the precedent set by Calendar's
// master filter and Database's search filters. Row delete stays inert (opens
// a confirm Dialog, Confirm just closes — no row removal).
export default function DbBrowserPage() {
  const [selectedTable, setSelectedTable] = useState<TableName>('user')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<DbRow | null>(null)

  function handleTableSelect(table: TableName) {
    setSelectedTable(table)
    setPage(1)
  }

  const rows = MOCK_ROWS[selectedTable]
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const columns = pageRows[0] ? Object.keys(pageRows[0]) : []

  return (
    <div className="rounded-[20px] border border-border bg-card shadow-sm overflow-hidden" style={{ minHeight: 'calc(100vh - 10rem)' }}>
      <div className="flex h-full" style={{ minHeight: 'calc(100vh - 10rem)' }}>
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
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
              <p className="text-xs text-muted-foreground">{total} rows total</p>
            </div>
            <Badge variant="warning">SUPERADMIN only</Badge>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-4">
            {pageRows.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">No rows.</div>
            ) : (
              <div className="rounded-[20px] border border-border overflow-hidden">
                {/* DB Browser keeps horizontal scroll at every breakpoint instead of
                    the table→card pattern used elsewhere in this admin — arbitrary/
                    dynamic columns (10-80+) are only readable aligned side-by-side;
                    see admin/AGENTS.md's table→card exception. */}
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full min-w-[720px] text-xs">
                    <thead className="bg-muted/50 border-b border-border sticky top-0">
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pageRows.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/40 transition-colors">
                          {columns.map((col) => {
                            const val = row[col]
                            const display =
                              val === null || val === undefined
                                ? '—'
                                : val instanceof Date
                                ? val.toLocaleString()
                                : String(val)
                            return (
                              <td key={col} className="px-3 py-1.5 max-w-[180px] truncate text-foreground align-middle" title={display}>
                                {display}
                              </td>
                            )
                          })}
                          <td className="px-3 py-1.5 align-middle">
                            <button
                              onClick={() => setDeleteTarget(row)}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                              title="Delete row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex h-9 items-center gap-1 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex h-9 items-center gap-1 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete row">
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Delete row "{String(deleteTarget['id'])}" from <span className="font-medium text-foreground">{selectedTable}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="h-9 rounded-md border border-input bg-transparent px-4 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
