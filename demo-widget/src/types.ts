export type Procedure = {
  id: string
  name: string
  durationMin: number
  /** Pre-discount price, struck through next to `price` — matches the
   * "-10% on all services" promo already advertised in `TodayPromoCard`. */
  priceOld: number
  price: number
}

export type Master = {
  id: string
  name: string
  title: string
  avatarInitial: string
  avatar: string | null
  bio: string
  achievements: string[]
  services: Procedure[]
  /** Demonstrates that each master's page can show different footer content —
   * a written bio, or a strip of reviews — configurable per master. */
  profileDisplay: 'bio' | 'reviews'
}
