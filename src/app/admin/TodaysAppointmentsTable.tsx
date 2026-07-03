import { Badge } from "@/components/ui/badge"
import AppointmentStatusBadge from "@/components/admin/AppointmentStatusBadge"

type Appointment = {
  id: string
  startTime: string
  status: string
  client: { name: string | null }
  service: { name: string; price: number }
  master: { name: string | null }
}

export default function TodaysAppointmentsTable({
  appointments,
}: {
  appointments: Appointment[]
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-base font-medium">Today&apos;s appointments</span>
        <span className="text-sm text-muted-foreground">{appointments.length} total</span>
      </div>

      {appointments.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No appointments scheduled for today.
        </div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Time
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Client
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Service
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Master
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Price
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((app) => (
              <tr key={app.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 font-medium">{app.startTime}</td>
                <td className="px-4 py-3">{app.client.name || "Unknown Client"}</td>
                <td className="px-4 py-3 text-muted-foreground">{app.service.name}</td>
                <td className="px-4 py-3">
                  <Badge variant="accent">{app.master.name || "—"}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{app.service.price} zł</td>
                <td className="px-4 py-3">
                  <AppointmentStatusBadge status={app.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
