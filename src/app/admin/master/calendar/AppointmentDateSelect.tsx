"use client"

import { useEffect, useState } from "react"
import { DatePickerDropdown } from "@/components/DatePickerDropdown"

interface AppointmentDateSelectProps {
  apiPrefix: string
  isAdminView: boolean
  masterId: string
  durationMin: number
  value: string
  onChange: (date: string) => void
  excludeOriginalDate?: string
}

/**
 * Date picker for the manual appointment form. Wraps DatePickerDropdown,
 * fetching the selected master's day-off dates from the availability API
 * (salon working hours, the master's schedule, and existing bookings) so
 * they render greyed-out/non-clickable instead of looking selectable.
 */
export default function AppointmentDateSelect({
  apiPrefix,
  isAdminView,
  masterId,
  durationMin,
  value,
  onChange,
  excludeOriginalDate,
}: AppointmentDateSelectProps) {
  const noMaster = isAdminView && !masterId
  const [visibleRange, setVisibleRange] = useState<{ from: string; until: string } | null>(null)
  const [disabledDates, setDisabledDates] = useState<Set<string> | undefined>(undefined)

  useEffect(() => {
    if (noMaster || !visibleRange || !durationMin) {
      setDisabledDates(undefined)
      return
    }

    let cancelled = false

    const params = new URLSearchParams({
      from: visibleRange.from,
      until: visibleRange.until,
      duration: String(durationMin),
    })
    if (masterId) params.set("masterId", masterId)

    fetch(`${apiPrefix}/availability/days?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const days: { date: string; hasWindow: boolean }[] = data.days || []
        const set = new Set(days.filter((d) => !d.hasWindow).map((d) => d.date))
        if (excludeOriginalDate) set.delete(excludeOriginalDate)
        setDisabledDates(set)
      })
      .catch(() => {
        if (cancelled) return
        setDisabledDates(undefined)
      })

    return () => {
      cancelled = true
    }
  }, [apiPrefix, isAdminView, masterId, durationMin, visibleRange])

  return (
    <DatePickerDropdown
      date={value}
      onChange={onChange}
      disabledDates={disabledDates}
      onVisibleMonthChange={(from, until) => setVisibleRange({ from, until })}
    />
  )
}
