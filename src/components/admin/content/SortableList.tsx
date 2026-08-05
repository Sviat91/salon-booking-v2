"use client"

import type { CSSProperties, ReactNode } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

export type DragHandleProps = {
  setNodeRef: (node: HTMLElement | null) => void
  style: CSSProperties
  attributes: ReturnType<typeof useSortable>["attributes"]
  listeners: ReturnType<typeof useSortable>["listeners"]
  isDragging: boolean
}

interface SortableItemProps {
  id: string
  children: (id: string, handle: DragHandleProps) => ReactNode
}

function SortableItem({ id, children }: SortableItemProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
  }
  return <>{children(id, { setNodeRef, style, attributes, listeners, isDragging })}</>
}

/** Layout of the caller's own container: `"list"` = single-column reflow, `"grid"` = wrapping multi-column grid. */
export type SortableStrategy = "list" | "grid"

const STRATEGIES = {
  list: verticalListSortingStrategy,
  grid: rectSortingStrategy,
} as const

interface SortableListProps {
  ids: string[]
  onReorder: (orderedIds: string[]) => void
  /** Defaults to `"list"` — unchanged behaviour for existing callers. */
  strategy?: SortableStrategy
  children: (id: string, handle: DragHandleProps) => ReactNode
}

/**
 * The single place dnd-kit is wired (AD-10, C-1.3). Renders its own
 * `DndContext` + `SortableContext` — callers must give each simultaneously
 * rendered list (e.g. the desktop table vs the `lg:hidden` mobile card list,
 * which share the same row ids) its own `SortableList` instance, never one
 * context spanning both, since dnd-kit requires ids unique per `DndContext`.
 *
 * No `DragOverlay` — a table row rendered into an overlay loses its `<td>`
 * widths, so this uses in-place transform only.
 *
 * Renders no DOM of its own, so the caller owns the container element
 * (`<tbody>`, flex column, or CSS grid) and `strategy` must match that
 * container's layout.
 */
export default function SortableList({ ids, onReorder, strategy = "list", children }: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={STRATEGIES[strategy]}>
        {ids.map((id) => (
          <SortableItem key={id} id={id}>
            {children}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  )
}
