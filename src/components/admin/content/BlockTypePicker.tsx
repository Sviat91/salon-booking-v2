"use client"

import { useTranslation } from "react-i18next"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectItemText,
} from "@/components/ui/select"
import type { BlockType } from "@/lib/content/blocks"

export type BlockTypeOrNone = BlockType | "none"

interface BlockTypePickerProps {
  value: BlockTypeOrNone
  onChange: (type: BlockTypeOrNone) => void
  allowed: BlockType[]
  /** Adds a leading "none" option — used by SingleBlockSlotEditor's two singleton slots. */
  includeNone?: boolean
  className?: string
}

export default function BlockTypePicker({ value, onChange, allowed, includeNone, className }: BlockTypePickerProps) {
  const { t } = useTranslation()

  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as BlockTypeOrNone)}>
      <SelectTrigger className={className ?? "h-9"}>
        <SelectValue>{(v: string) => t(`admin.pages.blockType.${v}`)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {includeNone && (
          <SelectItem value="none">
            <SelectItemText>{t('admin.pages.blockType.none')}</SelectItemText>
          </SelectItem>
        )}
        {allowed.map((type) => (
          <SelectItem key={type} value={type}>
            <SelectItemText>{t(`admin.pages.blockType.${type}`)}</SelectItemText>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
