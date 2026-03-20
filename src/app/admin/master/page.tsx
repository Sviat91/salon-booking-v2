import { redirect } from "next/navigation"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { startOfDay, endOfDay, addDays } from "date-fns"
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
        status: { notIn: ["CANCELLED_BY_CLIENT", "CANCELLED_BY_MASTER"] },
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
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Welcome back to your workspace</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 relative">
            <h3 className="tracking-tight text-sm font-medium">Appointments Today</h3>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold">{todayAppointments.length}</div>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 relative">
            <h3 className="tracking-tight text-sm font-medium">Upcoming (7 days)</h3>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold">{weekCount}</div>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 relative">
            <h3 className="tracking-tight text-sm font-medium">Total Clients</h3>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold">{totalClients}</div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold tracking-tight mb-4">Today's Appointments</h2>
        <AppointmentsList appointments={todayAppointments} />
      </div>
    </div>
  )
}
