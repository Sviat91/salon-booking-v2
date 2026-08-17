import { masters } from '../data'

export type MockAppointment = {
  id: string
  clientName: string
  clientPhone?: string
  masterId: string
  procedureName: string
  price: number
  originalPrice?: number
  discountLabel?: string
  discountPercent?: number
  status?: string
  notes?: string
  startISO: string
  endISO: string
}

const marek = masters.find((m) => m.id === 'marek')!
const anna = masters.find((m) => m.id === 'anna')!

// Invented plausible client names (same naming convention as the review
// screenshots) — real appointments in the admin never show "Deleted User";
// that's an artifact from an account that's since been GDPR-erased, not
// something to reproduce here.
function at(dayOffset: number, hour: number, minute: number, durationMin: number): { startISO: string; endISO: string } {
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() + dayOffset)
  base.setHours(hour, minute, 0, 0)
  const end = new Date(base.getTime() + durationMin * 60_000)
  return { startISO: base.toISOString(), endISO: end.toISOString() }
}

export const weekAppointments: MockAppointment[] = [
  {
    id: 'ap1',
    clientName: 'Kasia Wiśniewska',
    masterId: marek.id,
    procedureName: "Classic Men's Haircut",
    price: 99,
    status: 'CONFIRMED',
    ...at(0, 10, 0, 45),
  },
  {
    id: 'ap2',
    clientName: 'Tomasz Nowicki',
    clientPhone: '+48 601 234 567',
    masterId: marek.id,
    procedureName: 'Combo: Haircut & Beard',
    price: 153,
    originalPrice: 170,
    discountLabel: 'Welcome Glow',
    discountPercent: 10,
    status: 'CONFIRMED',
    ...at(0, 14, 0, 75),
  },
  {
    id: 'ap3',
    clientName: 'Ola Kamińska',
    masterId: anna.id,
    procedureName: 'Single-Process Color & Care',
    price: 288,
    status: 'CONFIRMED',
    ...at(-1, 11, 0, 120),
  },
  {
    id: 'ap4',
    clientName: 'David Lewandowski',
    clientPhone: '+48 512 345 678',
    masterId: marek.id,
    procedureName: 'Royal Shave with Hot Towel',
    price: 90,
    status: 'CONFIRMED',
    notes: 'Prefers unscented shaving cream.',
    ...at(2, 15, 0, 45),
  },
  {
    id: 'ap5',
    clientName: 'Maria Kowalska',
    masterId: anna.id,
    procedureName: 'Balayage / AirTouch Coloring',
    price: 495,
    status: 'PENDING',
    ...at(-2, 12, 0, 210),
  },
]

// Real appointment blocks get their color from each master's stored
// `masterProfile.color` (falls back to "#8B4A58" if unset) — same idea here.
export const MASTER_COLORS: Record<string, string> = {
  marek: '#166534',
  anna: '#B35C37',
}

// Shape mirrors the real `AdminMasterListItem` (id/name/masterProfile.color)
// consumed by CalendarToolbar's MasterSelectDropdown and BulkSettingsModal.
export const adminMastersList = masters.map((m) => ({ id: m.id, name: m.name, color: MASTER_COLORS[m.id] ?? '#8B4A58' }))

export const dashboardStats = {
  todayCount: weekAppointments.filter((a) => new Date(a.startISO).toDateString() === new Date().toDateString()).length,
  weekCount: weekAppointments.length,
  weekDelta: 4,
  revenueThisMonth: weekAppointments.reduce((sum, a) => sum + a.price, 0) + 1024.5,
}
