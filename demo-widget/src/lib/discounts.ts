// Mirrors the promo copy already advertised in TodayPromoCard: a blanket
// -10% on everything, bumped to -20% specifically Wed/Thu 11:00-15:00. The
// promo card is just merchandising copy (shows what's on generally); this is
// what actually gets applied to a specific booked slot.
const HAPPY_HOUR_DAYS = [3, 4] // Wed, Thu
const HAPPY_HOUR_START_HOUR = 11
const HAPPY_HOUR_END_HOUR = 15

function isHappyHour(startISO: string): boolean {
  const d = new Date(startISO)
  const day = d.getDay()
  const hour = d.getHours()
  return HAPPY_HOUR_DAYS.includes(day) && hour >= HAPPY_HOUR_START_HOUR && hour < HAPPY_HOUR_END_HOUR
}

export function computeFinalPrice(priceOld: number, startISO: string): { percent: number; price: number } {
  const percent = isHappyHour(startISO) ? 20 : 10
  return { percent, price: Math.round(priceOld * (1 - percent / 100)) }
}
