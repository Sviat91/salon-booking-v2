"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Move } from "lucide-react"

export const IFRAME_WIDTH = 1440
export const IFRAME_HEIGHT = 900

export default function HomepagePreview({
  logoUrl,
  posX,
  posY,
  logoWidth,
  logoHeight,
  logoLayer,
  onDragStart,
  previewRef,
  containerHeight,
}: {
  logoUrl: string | null
  posX: number
  posY: number
  logoWidth: number
  logoHeight: number
  logoLayer?: string
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void
  previewRef: React.RefObject<HTMLDivElement>
  containerHeight: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.25)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 400
      setScale(width / IFRAME_WIDTH)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scaledLogoW = Math.round(logoWidth * scale)
  const scaledLogoH = Math.round(logoHeight * scale)
  const visibleHeight = IFRAME_HEIGHT * scale

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg border border-border"
      style={{ height: containerHeight || visibleHeight }}
    >
      <iframe
        src="/?preview=1"
        title="Homepage preview"
        className="origin-top-left pointer-events-none"
        style={{
          width: IFRAME_WIDTH,
          height: IFRAME_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          border: "none",
        }}
        tabIndex={-1}
      />

      <div
        ref={previewRef}
        className="absolute inset-0 cursor-crosshair z-10"
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
      >
        {logoUrl ? (
          <div
            className={`absolute pointer-events-none transition-opacity ${logoLayer === 'below' ? 'opacity-40' : 'opacity-100'}`}
            style={{ left: `${posX}%`, top: `${posY}%` }}
          >
            <Image src={logoUrl} alt="Logo position" width={scaledLogoW} height={scaledLogoH} className="object-contain" />
          </div>
        ) : (
          <div
            className={`absolute pointer-events-none transition-opacity ${logoLayer === 'below' ? 'opacity-40' : 'opacity-100'}`}
            style={{ left: `${posX}%`, top: `${posY}%` }}
          >
            <div className="h-8 w-14 rounded border-2 border-dashed border-primary/50 flex items-center justify-center gap-0.5 bg-primary/10">
              <Move className="h-3 w-3 text-primary/60" />
              <span className="text-[9px] text-primary/60">Logo</span>
            </div>
          </div>
        )}

        <div className="absolute bottom-1 left-1 text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded">
          X {posX}% / Y {posY}%
        </div>
      </div>
    </div>
  )
}
