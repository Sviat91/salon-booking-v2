import type { CSSProperties, ReactNode } from 'react'

// Ported from the real app's StripWidget.tsx full-bleed marquee — same
// breakout trick, same repeat-count/duration math, same hover-pause.
const GAP = 24
const MIN_TOTAL_WIDTH = 4200
const MIN_COPIES = 3

function getRepeatCount(itemCount: number, itemWidth: number) {
  const setWidth = itemCount * (itemWidth + GAP)
  return Math.max(MIN_COPIES, Math.ceil(MIN_TOTAL_WIDTH / setWidth))
}

export default function MarqueeTrack({
  items,
  itemWidth,
}: {
  items: ReactNode[]
  itemWidth: number
}) {
  const repeatCount = getRepeatCount(items.length, itemWidth)
  const duration = Math.max(60, items.length * 8)
  const track = Array.from({ length: repeatCount }, () => items).flat()

  const style: CSSProperties & { '--marquee-end'?: string } = {
    width: 'fit-content',
    animationDuration: `${duration}s`,
    '--marquee-end': `-${100 / repeatCount}%`,
  }

  return (
    <div className="relative left-1/2 w-screen -ml-[50vw] select-none overflow-hidden py-4">
      <div className="flex items-center gap-6 px-4 animate-marquee" style={style}>
        {track.map((item, i) => (
          <div key={i}>{item}</div>
        ))}
      </div>
    </div>
  )
}
