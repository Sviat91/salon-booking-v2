export type Procedure = {
  id: string
  name: string
  durationMin: number
  price: number
}

export type Master = {
  id: string
  name: string
  title: string
  avatarInitial: string
  bio: string
  achievements: string[]
  services: Procedure[]
  /** Demonstrates that each master's page can show different footer content —
   * a written bio, or a strip of reviews — configurable per master. */
  profileDisplay: 'bio' | 'reviews'
}
