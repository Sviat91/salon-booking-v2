import { Eye } from 'lucide-react'
import { masters } from '../../data'
import { AdminSectionHeader } from '../AdminCard'
import Badge from '../../components/ui/badge'
import { MASTER_COLORS } from '../mockAdminData'

// Real masters list is a card-list (not a table), max-w-3xl centered — ported
// that layout exactly. View-only: no add/edit/delete here.
export default function MastersPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <AdminSectionHeader eyebrow="Masters" description="Specialists shown on the booking site." />
      <div className="flex flex-col gap-3">
        {masters.map((master) => (
          <div key={master.id} className="flex items-center gap-4 rounded-[20px] border border-border bg-card p-4 shadow-sm">
            <div
              className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full bg-muted"
              style={{ boxShadow: `0 0 0 3px ${MASTER_COLORS[master.id] ?? '#8B4A58'}` }}
            >
              {master.avatar && <img src={master.avatar} alt={master.name} className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[15px] font-medium text-foreground">{master.name}</p>
              <p className="truncate text-xs text-muted-foreground mt-0.5">{master.title}</p>
              <p className="truncate text-xs text-muted-foreground/80 mt-0.5">{master.bio}</p>
            </div>
            <div className="shrink-0">
              <Badge variant="success" className="gap-1">
                <Eye className="h-3 w-3" />
                Visible
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
