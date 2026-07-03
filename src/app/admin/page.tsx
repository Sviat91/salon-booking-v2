import Link from "next/link"
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
          service: { select: { name: true, price: true } },
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

  const monthRevenue = monthAppointments.reduce((sum, a) => sum + a.service.price, 0)
  const weekDelta = thisWeekCount - lastWeekCount
  const activeMastersToday = new Set(todayAppointments.map((a) => a.masterId)).size

  return { today, todayAppointments, thisWeekCount, weekDelta, monthRevenue, masters, activeMastersToday }
}

export default async function AdminDashboardPage() {
  const { today, todayAppointments, thisWeekCount, weekDelta, monthRevenue, masters, activeMastersToday } =
    await getDashboardData()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Overview
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{format(today, "EEEE, d MMMM yyyy")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today"
          value={todayAppointments.length}
          sub={`${activeMastersToday} masters active`}
          tone="primary"
        />
        <StatCard
          label="This week"
          value={thisWeekCount}
          sub={`${weekDelta >= 0 ? "+" : ""}${weekDelta} vs last week`}
          tone="secondary"
        />
        <StatCard
          label="Revenue"
          value={`${monthRevenue.toLocaleString()} zł`}
          sub="This month"
          tone="tertiary"
        />
        <StatCard
          label="Masters"
          value={masters.length}
          sub={masters.map((m) => m.name).join(" · ")}
          tone="surface-high"
        />
      </div>

      <TodaysAppointmentsTable appointments={todayAppointments} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/admin/services" />}>
            Manage Services
          </Button>
          <Button variant="outline" render={<Link href="/admin/masters" />}>
            Manage Masters
          </Button>
          <Button variant="outline" render={<Link href="/admin/settings" />}>
            Salon Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
