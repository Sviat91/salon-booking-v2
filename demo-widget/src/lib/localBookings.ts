export type StoredBooking = {
  id: string
  masterId: string
  masterName: string
  procedureId: string
  procedureName: string
  price: number
  startISO: string
  endISO: string
  name: string
  phone: string
}

const KEY = 'ordiset-demo-bookings'

export function getBookings(): StoredBooking[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StoredBooking[]) : []
  } catch {
    return []
  }
}

export function addBooking(booking: StoredBooking) {
  const all = getBookings()
  all.push(booking)
  localStorage.setItem(KEY, JSON.stringify(all))
}

/** Matches the same way real phone-based lookups do in the live app: last-digits comparison, not exact string equality. */
export function findBookings(fullName: string, phone: string): StoredBooking[] {
  const phoneDigits = phone.replace(/\D/g, '')
  const nameLower = fullName.trim().toLowerCase()
  if (phoneDigits.length < 6) return []

  return getBookings().filter((b) => {
    const bPhoneDigits = b.phone.replace(/\D/g, '')
    const phoneMatches = bPhoneDigits.endsWith(phoneDigits.slice(-6))
    const nameMatches = !nameLower || b.name.toLowerCase().includes(nameLower)
    return phoneMatches && nameMatches
  })
}
