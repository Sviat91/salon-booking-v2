"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Lightbox from "../Lightbox"

interface StackWidgetProps {
  photos: string[]
}

const MAX_PILE_VISIBLE = 5
const ROTATIONS = [-6, 4, -3, 5, -5, 3, -4, 6]

const CANDIDATE_GROUP_SIZES = [3, 5, 10, 20]
const MAX_STACKS_PER_ROW = 6
const EDGE_MARGIN = 16 // px — keep the expanded row at least this far from the viewport edge

function getGroupSize(photoCount: number): number {
  for (const size of CANDIDATE_GROUP_SIZES) {
    if (Math.ceil(photoCount / size) <= MAX_STACKS_PER_ROW) return size
  }
  return Math.ceil(photoCount / MAX_STACKS_PER_ROW)
}

interface PileProps {
  photos: string[]
  startIndex: number
  isExpanded: boolean
  onExpand: () => void
  onCollapse: () => void
  onPhotoClick: (index: number) => void
}

/** A single Mac-Photos-style pile that expands in place into a flat photo row, clamped to stay on-screen. */
function Pile({ photos, startIndex, isExpanded, onExpand, onCollapse, onPhotoClick }: PileProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [shiftX, setShiftX] = useState(0)

  useEffect(() => {
    if (!isExpanded || !overlayRef.current) return
    const rect = overlayRef.current.getBoundingClientRect()
    // rect already reflects the base `left-1/2 -translate-x-1/2` centering — measure
    // its natural edges and nudge just enough to keep both inside the viewport.
    let shift = 0
    if (rect.left < EDGE_MARGIN) shift = EDGE_MARGIN - rect.left
    else if (rect.right > window.innerWidth - EDGE_MARGIN) shift = window.innerWidth - EDGE_MARGIN - rect.right
    setShiftX(shift)
  }, [isExpanded, photos.length])

  useEffect(() => {
    if (!isExpanded) return
    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onCollapse()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isExpanded, onCollapse])

  if (isExpanded) {
    return (
      <div className="relative h-40 w-32 shrink-0">
        <div
          ref={overlayRef}
          className="absolute left-1/2 top-0 z-30 flex h-40 max-w-[min(90vw,640px)] items-center gap-2 overflow-x-auto overflow-y-visible rounded-xl bg-card/95 shadow-xl"
          style={{ transform: `translateX(calc(-50% + ${shiftX}px))` }}
        >
          {photos.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => onPhotoClick(startIndex + i)}
              className="relative h-40 w-32 shrink-0 overflow-hidden rounded-xl border border-border"
            >
              <Image src={url} alt="" fill className="object-cover" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  const visible = photos.slice(0, MAX_PILE_VISIBLE)

  return (
    <button type="button" onClick={onExpand} className="relative h-40 w-32 shrink-0">
      {visible.map((url, i) => (
        <div
          key={`${url}-${i}`}
          className="absolute inset-0 overflow-hidden rounded-xl border border-border bg-card shadow-md"
          style={{
            transform: `rotate(${ROTATIONS[i % ROTATIONS.length]}deg) translate(${((i % 3) - 1) * 4}px, ${(i % 2) * 3}px)`,
            zIndex: i,
          }}
        >
          <Image src={url} alt="" fill className="object-cover" />
        </div>
      ))}
    </button>
  )
}

/** Mac-Photos-style stacked thumbnails, split into adaptively-sized groups that expand in place. */
export default function StackWidget({ photos }: StackWidgetProps) {
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (photos.length === 0) return null

  const groupSize = getGroupSize(photos.length)
  const groups: { startIndex: number; photos: string[] }[] = []
  for (let i = 0; i < photos.length; i += groupSize) {
    groups.push({ startIndex: i, photos: photos.slice(i, i + groupSize) })
  }

  return (
    <>
      <div
        className="relative left-1/2 w-screen -ml-[50vw] flex items-start gap-6 overflow-x-auto overflow-y-visible px-4 py-2"
        style={{ justifyContent: "safe center" }}
      >
        {groups.map((group, groupIndex) => (
          <Pile
            key={group.startIndex}
            photos={group.photos}
            startIndex={group.startIndex}
            isExpanded={expandedGroup === groupIndex}
            onExpand={() => setExpandedGroup(groupIndex)}
            onCollapse={() => setExpandedGroup(null)}
            onPhotoClick={setLightboxIndex}
          />
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </>
  )
}
