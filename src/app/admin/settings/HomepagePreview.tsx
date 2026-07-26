"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { useTranslation } from "react-i18next"
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
  homepageWidgetBlock,
}: {
  logoUrl: string | null
  posX: number
  posY: number
  logoWidth: number
  logoHeight: number
  logoLayer?: string
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void
  previewRef: React.RefObject<HTMLDivElement>
  /** Optional cap on the preview's height (e.g. to keep the desktop inline preview compact).
   * Acts as a MAX, not a fixed override — the preview never exceeds its natural
   * width-driven `visibleHeight`, so it still scales down proportionally on mobile. */
  containerHeight: number
  /** Current homepage widget slot value — included in the iframe's `key` so saving a
   * change to it forces the preview iframe to remount and refetch, same as the
   * existing dark/light remount-on-change behavior. */
  homepageWidgetBlock?: string | null
}) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.25)
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

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

  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => setIsDark(el.classList.contains('dark')))
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const scaledLogoW = Math.round(logoWidth * scale)
  const scaledLogoH = Math.round(logoHeight * scale)
  const visibleHeight = IFRAME_HEIGHT * scale

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg border border-border"
      style={{ height: containerHeight ? Math.min(containerHeight, visibleHeight) : visibleHeight }}
    >
      <iframe
        key={`${isDark ? 'preview-dark' : 'preview-light'}-${homepageWidgetBlock ?? ''}`}
        src="/?preview=1"
        title={t('admin.settings.general.homepagePreviewTitle')}
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
              <span className="text-[9px] text-primary/60">{t('admin.settings.general.logoFallbackLabel')}</span>
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
