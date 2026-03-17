"use client"
import { useTranslation } from "react-i18next"
import { Users, CalendarCheck, DollarSign, Scissors } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function AdminDashboardPage() {
  const { t } = useTranslation()

  // Mocks for now, will replace with Server Actions or swr fetching
  const stats = [
    {
      title: "Total Appointments",
      value: "1,248",
      description: "+20.1% from last month",
      icon: CalendarCheck,
    },
    {
      title: "Total Revenue",
      value: "45,231 zł",
      description: "+15% from last month",
      icon: DollarSign,
    },
    {
      title: "Active Specialists",
      value: "4",
      description: "+1 since last month",
      icon: Users,
    },
    {
      title: "Active Services",
      value: "12",
      description: "0 change",
      icon: Scissors,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('admin.panel', 'Admin Panel')}
        </h1>
        <p className="text-muted-foreground mt-2">
          Overview of your salon's performance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
