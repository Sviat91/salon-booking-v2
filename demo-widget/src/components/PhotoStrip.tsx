import MarqueeTrack from './MarqueeTrack'

const TILE_WIDTH = 112
const TILE_HEIGHT = 140
const PLACEHOLDER_COUNT = 8

export default function PhotoStrip() {
  const items = Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
    <div
      className="relative flex-shrink-0 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/30 to-accent/40"
      style={{ height: TILE_HEIGHT, width: TILE_WIDTH }}
    >
      <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">#{i + 1}</div>
    </div>
  ))

  return (
    <div className="mt-12">
      <MarqueeTrack items={items} itemWidth={TILE_WIDTH} />
    </div>
  )
}
