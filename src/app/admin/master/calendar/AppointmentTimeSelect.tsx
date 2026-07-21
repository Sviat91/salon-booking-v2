"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectItemText } from "@/components/ui/select"

interface AppointmentTimeSelectProps {
  apiPrefix: string
  isAdminView: boolean
  masterId: string
  date: string
  durationMin: number
  value: string
  onChange: (time: string) => void
  onOptionsResolved?: (times: string[]) => void
  excludeAppointmentId?: string
}

/**
 * Time-of-day picker for the manual appointment form.
 * Fetches real available slots from the availability API (salon working hours,
 * the selected master's schedule, and existing bookings) instead of allowing
 * any arbitrary time to be picked.
 */
export default function AppointmentTimeSelect({
  apiPrefix,
  isAdminView,
  masterId,
  date,
  durationMin,
  value,
  onChange,
  onOptionsResolved,
  excludeAppointmentId,
}: AppointmentTimeSelectProps) {
  const { t } = useTranslation()
  const noMasterSelected = isAdminView && !masterId
  const [times, setTimes] = useState<string[]>([])
  const [loading, setLoading] = useState(!noMasterSelected)

  useEffect(() => {
    if (noMasterSelected || !date || !durationMin) {
      setTimes([])
      onOptionsResolved?.([])
      return
    }

    let cancelled = false
    setLoading(true)

    const params = new URLSearchParams({ date, duration: String(durationMin) })
    if (masterId) params.set("masterId", masterId)
    if (excludeAppointmentId) params.set("excludeAppointmentId", excludeAppointmentId)

    fetch(`${apiPrefix}/availability/slots?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const raw: string[] = (data.slots || []).map((s: { startISO: string }) => s.startISO.slice(11, 16))
        const unique = Array.from(new Set(raw)).sort()
        setTimes(unique)
        onOptionsResolved?.(unique)
      })
      .catch(() => {
        if (cancelled) return
        setTimes([])
        onOptionsResolved?.([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [apiPrefix, isAdminView, masterId, date, durationMin, excludeAppointmentId])

  if (noMasterSelected) {
    return (
      <Select value="" disabled>
        <SelectTrigger className="h-10">
          <SelectValue>{() => t('admin.calendar.selectMasterFirstHint')}</SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
    )
  }

  if (loading) {
    return (
      <Select value="" disabled>
        <SelectTrigger className="h-10">
          <SelectValue>{() => t('common.loading')}</SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
    )
  }

  if (times.length === 0) {
    return (
      <Select value="" disabled>
        <SelectTrigger className="h-10">
          <SelectValue>{() => t('admin.calendar.noAvailableTimes')}</SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
    )
  }

  const isStale = value !== "" && !times.includes(value)
  const options = isStale ? [...times, value].sort() : times

  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger className={isStale ? "h-10 text-destructive" : "h-10"}>
        <SelectValue>
          {(v: string) => v || t('admin.calendar.startTimePlaceholder')}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((time) => (
          <SelectItem key={time} value={time} className={isStale && time === value ? "text-destructive" : undefined}>
            <SelectItemText>{time}</SelectItemText>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
