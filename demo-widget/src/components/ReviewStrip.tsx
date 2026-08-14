import MarqueeTrack from './MarqueeTrack'

const TILE_WIDTH = 170
const TILE_HEIGHT = 190

// Real review-card screenshots (Google review, TripAdvisor, Instagram DM,
// SMS, a "Verified Purchase" card) — replaced the earlier hand-built
// QuoteCard/GoogleReviewCard/MapCard components once real assets arrived,
// same treatment PhotoStrip got.
const REVIEWS = [1, 2, 3, 4, 5, 6].map((i) => `/strip/anna-${i}.png`)

export default function ReviewStrip() {
  const items = REVIEWS.map((src) => (
    <div className="relative flex-shrink-0 overflow-hidden rounded-2xl" style={{ height: TILE_HEIGHT, width: TILE_WIDTH }}>
      <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
    </div>
  ))

  return (
    <div className="mt-8">
      <MarqueeTrack items={items} itemWidth={TILE_WIDTH} />
    </div>
  )
}
