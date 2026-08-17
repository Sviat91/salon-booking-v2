import StatCard from '../StatCard'
import AdminCard from '../AdminCard'
import { masters } from '../../data'
import { weekAppointments, dashboardStats } from '../mockAdminData'

// Ported from the real admin/page.tsx: eyebrow + date, 4 stat tiles,
// today's-appointments table, quick actions card.
export default function DashboardPage() {
  const today = weekAppointments.filter((a) => new Date(a.startISO).toDateString() === new Date().toDateString())

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overview</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today" value={String(dashboardStats.todayCount)} sub={`${masters.length} masters active`} tone="primary" />
        <StatCard label="This week" value={String(dashboardStats.weekCount)} sub={`+${dashboardStats.weekDelta} vs last week`} tone="secondary" />
        <StatCard label="Revenue" value={`${dashboardStats.revenueThisMonth.toFixed(1)} zł`} sub="This month" tone="tertiary" />
        <StatCard label="Masters" value={String(masters.length)} sub={masters.map((m) => m.name).join(' · ')} tone="surface-high" />
      </div>

      <AdminCard className="rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <span className="text-base font-medium">Today's appointments</span>
          <span className="text-sm text-muted-foreground">Total: {today.length}</span>
        </div>
        {today.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">No appointments scheduled for today.</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Client</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Service</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Master</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody>
              {today.map((a) => {
                const master = masters.find((m) => m.id === a.masterId)
                return (
                  <tr key={a.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 font-medium">{a.clientName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.procedureName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{master?.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(a.startISO).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </AdminCard>

      <AdminCard className="p-4">
        <div className="mb-3 text-base font-medium">Quick actions</div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            Manage services
          </button>
          <button className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            Manage masters
          </button>
          <button className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            Salon settings
          </button>
        </div>
      </AdminCard>
    </div>
  )
}
