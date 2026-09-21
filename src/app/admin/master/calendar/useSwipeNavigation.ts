"use client"

import { useCallback, useRef } from "react"

export function useSwipeNavigation({ enabled, onPrev, onNext }: { enabled: boolean; onPrev: () => void; onNext: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // A second finger (pinch) or a disabled state must drop any pending start point,
    // otherwise the first finger's later touchend would measure from a stale origin.
    if (!enabled || e.touches.length !== 1) {
      start.current = null
      return
    }
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [enabled])

  const onTouchCancel = useCallback(() => {
    start.current = null
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const s = start.current
    start.current = null
    if (!enabled || !s) return
    const dx = e.changedTouches[0].clientX - s.x
    const dy = e.changedTouches[0].clientY - s.y
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) onNext()
      else onPrev()
    }
  }, [enabled, onPrev, onNext])

  return { onTouchStart, onTouchEnd, onTouchCancel }
}
