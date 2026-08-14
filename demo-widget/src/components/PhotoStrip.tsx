import MarqueeTrack from './MarqueeTrack'

const TILE_WIDTH = 112
const TILE_HEIGHT = 140

// Real salon-floor photos — each already carries its own rounded/framed
// border baked into the image, so the tile wrapper only clips corners
// (`overflow-hidden rounded-2xl`) rather than also drawing a CSS border on
// top of one that's already there.
const PHOTOS = [1, 2, 3, 4, 5, 6].map((i) => `/strip/home-${i}.png`)

export default function PhotoStrip() {
  const items = PHOTOS.map((src) => (
    <div className="relative flex-shrink-0 overflow-hidden rounded-2xl" style={{ height: TILE_HEIGHT, width: TILE_WIDTH }}>
      <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
    </div>
  ))

  return (
    <div className="mt-12">
      <MarqueeTrack items={items} itemWidth={TILE_WIDTH} />
    </div>
  )
}
