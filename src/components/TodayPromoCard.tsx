"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { useTranslation } from "react-i18next"
import { Card } from "@/components/ui/card"
import { DISCOUNT_DAY_KEYS, type DiscountInterval } from "@/lib/discounts/shared"

interface TodayDiscount {
  percent: number
  startDate: string | null
  endDate: string | null
  windowDays: number[]
  windowIntervals: DiscountInterval[]
  matchesSelectedService: boolean
}

/**
 * Lists currently-advertised promotions (see /api/discounts/today's doc
 * comment for exactly which ones qualify) as plain lines inside one card —
 * never one nested card per discount. Renders nothing when the list is
 * empty. Re-fetches whenever `serviceId` changes so picking a service with
 * its own discount updates the wording immediately.
 */
export default function TodayPromoCard({ masterId, serviceId }: { masterId: string; serviceId?: string }) {
  const { t } = useTranslation()
  const { data } = useQuery<{ discounts: TodayDiscount[] }>({
    queryKey: ["discount-today", masterId, serviceId ?? null],
    queryFn: () =>
      fetch(`/api/discounts/today?masterId=${masterId}${serviceId ? `&serviceId=${serviceId}` : ""}`).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  })

  const discounts = data?.discounts ?? []
  if (discounts.length === 0) return null

  return (
    <Card className="!px-2 !py-3 sm:!px-4 sm:!py-4">
      <div className="space-y-1.5">
        {discounts.map((d, i) => (
          <p key={i} className="text-sm font-medium text-foreground">
            🏷️ {formatDiscountLine(d, t)}
          </p>
        ))}
      </div>
    </Card>
  )
}

function formatDiscountLine(d: TodayDiscount, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const qualifiers: string[] = []

  if (d.startDate || d.endDate) {
    qualifiers.push(formatPeriod(d.startDate, d.endDate, t))
  }
  if (d.windowDays.length > 0 && d.windowIntervals.length > 0) {
    qualifiers.push(formatWindow(d.windowDays, d.windowIntervals, t))
  }

  const scope = d.matchesSelectedService
    ? t('booking.discountSelectedService')
    : t('booking.discountAllServices')

  const prefix = qualifiers.length > 0 ? `${qualifiers.join(' · ')}: ` : ''
  return `${prefix}-${d.percent}% ${scope}`
}

function formatPeriod(startISO: string | null, endISO: string | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const start = startISO ? format(new Date(startISO), 'd.MM') : null
  const end = endISO ? format(new Date(endISO), 'd.MM') : null
  if (start && end) return t('booking.discountPeriodRange', { start, end })
  if (start) return t('booking.discountPeriodFrom', { start })
  return t('booking.discountPeriodUntil', { end })
}

function formatWindow(days: number[], intervals: DiscountInterval[], t: (key: string, opts?: Record<string, unknown>) => string): string {
  const dayLabels = days.map((d) => t(DISCOUNT_DAY_KEYS[d])).join(', ')
  const { start, end } = intervals[0]
  return `${dayLabels} ${start}–${end}`
}
