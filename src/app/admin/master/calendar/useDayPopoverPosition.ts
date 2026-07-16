import { useState, useLayoutEffect, type RefObject, type CSSProperties } from "react"

const POPOVER_WIDTH = 260
const POPOVER_HEIGHT_ESTIMATE = 240
const GAP = 8

/**
 * Computes fixed viewport coordinates for a small popover anchored below (or above, if
 * insufficient room) a trigger button — mirrors TimePickerDropdown.tsx's positioning
 * pattern (useLayoutEffect so the position commits before paint, no visible jump).
 * Recomputes whenever `openKey` changes (pass the value identifying which trigger is
 * open, e.g. a date string, or null when closed).
 */
export function useDayPopoverPosition(triggerRef: RefObject<HTMLElement>, openKey: string | null) {
  const [style, setStyle] = useState<CSSProperties>({})

  useLayoutEffect(() => {
    if (openKey && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom - GAP
      const left = Math.max(8, Math.min(
        rect.left + rect.width / 2 - POPOVER_WIDTH / 2,
        window.innerWidth - POPOVER_WIDTH - 8
      ))

      if (spaceBelow >= POPOVER_HEIGHT_ESTIMATE) {
        setStyle({ position: 'fixed', top: `${rect.bottom + GAP}px`, left: `${left}px`, width: `${POPOVER_WIDTH}px`, zIndex: 9999 })
      } else {
        setStyle({ position: 'fixed', bottom: `${window.innerHeight - rect.top + GAP}px`, left: `${left}px`, width: `${POPOVER_WIDTH}px`, zIndex: 9999 })
      }
    }
  }, [openKey])

  return style
}
