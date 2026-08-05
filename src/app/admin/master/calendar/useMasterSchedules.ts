import { useState, useEffect } from "react"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns"
import type { Override, Template } from "./ModernCalendar"

export type MasterSchedule = { overrides: Override[]; templates: Template[] }

export function useMasterSchedules(opts: {
  masterIds: string[]
  month: Date
  apiPrefix: string
  enabled: boolean
}): { schedules: Record<string, MasterSchedule>; refetch: () => void } {
  const { masterIds, month, apiPrefix, enabled } = opts
  const [schedules, setSchedules] = useState<Record<string, MasterSchedule>>({})
  const [reloadKey, setReloadKey] = useState(0)

  const idsKey = [...masterIds].sort().join(",")
  const monthKey = format(startOfMonth(month), "yyyy-MM")

  useEffect(() => {
    if (!enabled || idsKey === "") {
      setSchedules({})
      return
    }

    let cancelled = false
    const ids = idsKey.split(",")
    const from = format(startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), "yyyy-MM-dd")
    const to = format(endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), "yyyy-MM-dd")

    async function load() {
      const entries = await Promise.all(
        ids.map(async (id): Promise<[string, MasterSchedule]> => {
          try {
            const [ovrRes, tmplRes] = await Promise.all([
              fetch(`${apiPrefix}/schedule/overrides?from=${from}&to=${to}&masterId=${id}`),
              fetch(`${apiPrefix}/schedule/template?masterId=${id}`)
            ])
            const ovrData = await ovrRes.json()
            const tmplData = await tmplRes.json()
            const overrides = (ovrData.overrides || []).map((o: any) => ({
              ...o,
              date: typeof o.date === 'string' ? o.date.substring(0, 10) : format(new Date(o.date), 'yyyy-MM-dd'),
              intervals: JSON.parse(o.intervals)
            }))
            const templates = (tmplData.templates || []).map((t: any) => ({ ...t, intervals: JSON.parse(t.intervals) }))
            return [id, { overrides, templates }]
          } catch {
            return [id, { overrides: [], templates: [] }]
          }
        })
      )
      if (cancelled) return
      const next: Record<string, MasterSchedule> = {}
      for (const [id, schedule] of entries) next[id] = schedule
      setSchedules(next)
    }

    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- idsKey/monthKey are stable string deps; masterIds/month are unstable identities (Set-derived array, Date) that would refetch every render
  }, [idsKey, monthKey, enabled, apiPrefix, reloadKey])

  return { schedules, refetch: () => setReloadKey(k => k + 1) }
}
