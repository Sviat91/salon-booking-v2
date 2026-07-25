"use client"

import { useState } from "react"
import BlockTypePicker from "./BlockTypePicker"
import BlockConfigEditor from "./BlockConfigEditor"
import {
  defaultConfigFor,
  parseBlockSlot,
  serializeBlockSlot,
  type BlockType,
  type BlockSlot,
} from "@/lib/content/blocks"
import type { Language } from "@/lib/i18n-shared"

interface SingleBlockSlotEditorProps {
  /** Hidden input name — plugs into an existing `<form action={serverAction}>` without new save wiring. */
  name: string
  value: string | null
  allowed: BlockType[]
  enabledLocales: Language[]
  onChange?: () => void
}

/**
 * Shared "none / pick a type / edit its config" control for both singleton
 * slots (`TenantConfig.homepageWidgetBlock`, `MasterProfile.footerBlock`).
 */
export default function SingleBlockSlotEditor({ name, value, allowed, enabledLocales, onChange }: SingleBlockSlotEditorProps) {
  const [slot, setSlot] = useState<BlockSlot | null>(() => parseBlockSlot(value))

  function handleTypeChange(type: BlockType | "none") {
    setSlot(type === "none" ? null : { type, config: defaultConfigFor(type) })
    onChange?.()
  }

  return (
    <div className="flex flex-col gap-4">
      <BlockTypePicker
        value={slot?.type ?? "none"}
        onChange={handleTypeChange}
        allowed={allowed}
        includeNone
        className="h-9 max-w-xs"
      />
      {slot && (
        <BlockConfigEditor
          type={slot.type}
          config={slot.config}
          onChange={(config) => {
            setSlot({ type: slot.type, config })
            onChange?.()
          }}
          enabledLocales={enabledLocales}
        />
      )}
      <input type="hidden" name={name} value={serializeBlockSlot(slot)} />
    </div>
  )
}
