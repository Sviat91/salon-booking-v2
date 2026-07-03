import { redirect } from "next/navigation"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { startOfDay, endOfDay, addDays, format } from "date-fns"
import StatCard from "@/components/admin/StatCard"
import AppointmentsList from "./AppointmentsList"

export default async function MasterDashboardPage() {
  const session = await auth()
  
  if (!session?.user?.id || session.user.role !== "MASTER") {
    redirect("/auth/login")
  }

  const masterId = session.user.id
  const today = new Date()

  const todayAppointments = await prisma.appointment.findMany({
    where: {
      masterId,
      date: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
      status: { not: "CANCELLED" },
    },
    include: {
      service: true,
      client: true,
    },
    orderBy: { startTime: "asc" },
  })

  const startOfWeekDate = startOfDay(today)
  const endOfWeekDate = endOfDay(addDays(today, 7))

  const [weekCount, totalClients] = await Promise.all([
    prisma.appointment.count({
      where: {
        masterId,
        date: { gte: startOfWeekDate, lte: endOfWeekDate },
        status: { not: "CANCELLED" },
      },
    }),
    prisma.appointment.groupBy({
      by: ["clientId"],
      where: { masterId },
    }).then(res => res.length)
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Overview
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{format(today, "EEEE, d MMMM yyyy")}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Appointments Today" value={todayAppointments.length} tone="primary" />
        <StatCard label="Upcoming (7 days)" value={weekCount} tone="secondary" />
        <StatCard label="Total Clients" value={totalClients} tone="tertiary" />
      </div>

      <div>
        <h2 className="text-xl font-bold tracking-tight mb-4">Today's Appointments</h2>
        <AppointmentsList appointments={todayAppointments} />
      </div>
    </div>
  )
}
