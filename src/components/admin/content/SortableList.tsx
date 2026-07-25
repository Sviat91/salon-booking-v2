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

interface SortableListProps {
  ids: string[]
  onReorder: (orderedIds: string[]) => void
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
 */
export default function SortableList({ ids, onReorder, children }: SortableListProps) {
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
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {ids.map((id) => (
          <SortableItem key={id} id={id}>
            {children}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  )
}
