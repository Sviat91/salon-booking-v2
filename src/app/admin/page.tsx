import { CalendarCheck, DollarSign, Users, Scissors } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import prisma from "@/lib/prisma"

async function getStats() {
  const [totalAppointments, totalMasters, totalServices, revenue] =
    await Promise.all([
      prisma.appointment.count(),
      prisma.user.count({ where: { role: "MASTER" } }),
      prisma.service.count(),
      prisma.appointment.findMany({
        where: { status: "COMPLETED" },
        include: { service: { select: { price: true } } },
      }),
    ])

  const totalRevenue = revenue.reduce((sum, a) => sum + a.service.price, 0)

  return { totalAppointments, totalMasters, totalServices, totalRevenue }
}

export default async function AdminDashboardPage() {
  const stats = await getStats()

  const cards = [
    {
      title: "Total Appointments",
      value: stats.totalAppointments.toLocaleString(),
      description: "All time bookings",
      icon: CalendarCheck,
    },
    {
      title: "Revenue",
      value: `${stats.totalRevenue.toLocaleString()} zł`,
      description: "From completed appointments",
      icon: DollarSign,
    },
    {
      title: "Masters",
      value: stats.totalMasters.toString(),
      description: "Active specialists",
      icon: Users,
    },
    {
      title: "Services",
      value: stats.totalServices.toString(),
      description: "Available services",
      icon: Scissors,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your salon&apos;s performance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <a href="/admin/services" className="text-primary hover:underline">
              → Manage Services
            </a>
            <a href="/admin/masters" className="text-primary hover:underline">
              → Manage Masters
            </a>
            <a href="/admin/settings" className="text-primary hover:underline">
              → Salon Settings
            </a>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Status</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-2" />
              Database connected
            </p>
            <p>
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-2" />
              Auth active
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
