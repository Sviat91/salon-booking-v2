import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import StatCard from "@/components/admin/StatCard"
import TodaysAppointmentsTable from "./TodaysAppointmentsTable"
import prisma from "@/lib/prisma"
import { getServerT, getServerLanguage } from "@/lib/i18n-server"
import { dateFnsLocale } from "@/lib/utils/date-fns-locale"
import { resolveAppointmentPrice } from "@/lib/discounts/shared"

async function getDashboardData() {
  const today = new Date()
  const todayStart = startOfDay(today)
  const todayEnd = endOfDay(today)
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })
  const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  const [todayAppointments, thisWeekCount, lastWeekCount, monthAppointments, masters] =
    await Promise.all([
      prisma.appointment.findMany({
        where: { date: { gte: todayStart, lte: todayEnd } },
        include: {
          client: { select: { name: true } },
          service: { select: { name_pl: true, name_en: true, name_uk: true, price: true } },
          master: { select: { name: true } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.appointment.count({ where: { date: { gte: weekStart, lte: weekEnd } } }),
      prisma.appointment.count({ where: { date: { gte: lastWeekStart, lte: lastWeekEnd } } }),
      prisma.appointment.findMany({
        where: {
          date: { gte: monthStart, lte: monthEnd },
          status: { notIn: ["CANCELLED", "CANCELLED_BY_MASTER"] },
        },
        include: { service: { select: { price: true } } },
      }),
      prisma.user.findMany({ where: { role: "MASTER" }, select: { id: true, name: true } }),
    ])

  const monthRevenue = monthAppointments.reduce(
    (sum, a) => sum + resolveAppointmentPrice(a.finalPrice, a.service.price),
    0
  )
  const weekDelta = thisWeekCount - lastWeekCount
  const activeMastersToday = new Set(todayAppointments.map((a) => a.masterId)).size

  return { today, todayAppointments, thisWeekCount, weekDelta, monthRevenue, masters, activeMastersToday }
}

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role ?? "")) {
    redirect("/auth/login")
  }

  const { today, todayAppointments, thisWeekCount, weekDelta, monthRevenue, masters, activeMastersToday } =
    await getDashboardData()
  const t = getServerT()
  const language = getServerLanguage()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('admin.dashboard.overview')}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {format(today, "EEEE, d MMMM yyyy", { locale: dateFnsLocale(language) })}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('admin.dashboard.today')}
          value={todayAppointments.length}
          sub={t('admin.dashboard.mastersActive', { count: activeMastersToday })}
          tone="primary"
        />
        <StatCard
          label={t('admin.dashboard.thisWeek')}
          value={thisWeekCount}
          sub={t('admin.dashboard.vsLastWeek', { delta: `${weekDelta >= 0 ? "+" : ""}${weekDelta}` })}
          tone="secondary"
        />
        <StatCard
          label={t('admin.dashboard.revenue')}
          value={`${monthRevenue.toLocaleString()} zł`}
          sub={t('admin.dashboard.thisMonth')}
          tone="tertiary"
        />
        <StatCard
          label={t('admin.dashboard.masters')}
          value={masters.length}
          sub={masters.map((m) => m.name).join(" · ")}
          tone="surface-high"
        />
      </div>

      <TodaysAppointmentsTable appointments={todayAppointments} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.dashboard.quickActions')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/admin/services" />}>
            {t('admin.dashboard.manageServices')}
          </Button>
          <Button variant="outline" render={<Link href="/admin/masters" />}>
            {t('admin.dashboard.manageMasters')}
          </Button>
          <Button variant="outline" render={<Link href="/admin/settings" />}>
            {t('admin.dashboard.salonSettings')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
