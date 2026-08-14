import MarqueeTrack from './MarqueeTrack'

const CARD_WIDTH = 280

function Stars({ count = 5 }: { count?: number }) {
  return <span className="text-primary tracking-tight">{'★'.repeat(count)}</span>
}

function QuoteCard({ name, text }: { name: string; text: string }) {
  return (
    <div
      className="flex-shrink-0 rounded-2xl border border-border bg-card p-4 shadow-sm"
      style={{ width: CARD_WIDTH, minHeight: 150 }}
    >
      <Stars />
      <p className="text-sm text-card-foreground mt-2">“{text}”</p>
      <p className="text-xs text-muted-foreground mt-3">— {name}</p>
    </div>
  )
}

function GoogleReviewCard({ name, text }: { name: string; text: string }) {
  return (
    <div
      className="flex-shrink-0 rounded-2xl border border-border bg-card p-4 shadow-sm"
      style={{ width: CARD_WIDTH, minHeight: 150 }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
          G
        </span>
        <span className="text-xs font-medium text-muted-foreground">Google review</span>
      </div>
      <div className="mt-2">
        <Stars />
      </div>
      <p className="text-sm text-card-foreground mt-2">“{text}”</p>
      <p className="text-xs text-muted-foreground mt-3">— {name}</p>
    </div>
  )
}

function MapCard({ address, rating, count }: { address: string; rating: number; count: number }) {
  return (
    <div
      className="flex-shrink-0 rounded-2xl border border-border bg-card p-4 shadow-sm"
      style={{ width: CARD_WIDTH, minHeight: 150 }}
    >
      <div className="flex items-center gap-1 text-sm font-medium text-card-foreground">📍 Loom & Blade</div>
      <p className="text-sm text-muted-foreground mt-2">{address}</p>
      <p className="text-sm text-card-foreground mt-3">
        <Stars count={5} /> <span className="font-medium">{rating}</span>{' '}
        <span className="text-muted-foreground">({count} reviews)</span>
      </p>
    </div>
  )
}

export default function ReviewStrip() {
  const items = [
    <QuoteCard name="Kasia W." text="Anna transformed my hair completely — best balayage I've ever had!" />,
    <GoogleReviewCard name="Marta P." text="Professional, precise, and so friendly. Highly recommend!" />,
    <MapCard address="ul. Grzybowska 62, Warszawa" rating={4.9} count={128} />,
    <QuoteCard name="Ola K." text="My go-to colorist. Always leaves with exactly the look I wanted." />,
    <GoogleReviewCard name="Zofia T." text="AirTouch coloring came out stunning. Worth every złoty." />,
  ]

  return (
    <div className="mt-8">
      <MarqueeTrack items={items} itemWidth={CARD_WIDTH} />
    </div>
  )
}
