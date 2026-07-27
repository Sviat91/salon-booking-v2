"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { GripVertical, Plus, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import BlockTypePicker from "./BlockTypePicker"
import BlockConfigEditor from "./BlockConfigEditor"
import SortableList from "./SortableList"
import { createBlock, deleteBlock, reorderBlocks, updateBlockConfig } from "@/app/admin/pages/block-actions"
import { BLOCK_TYPES, parseBlockConfig, type BlockConfig, type BlockType, type TextBlockConfig } from "@/lib/content/blocks"
import { cn } from "@/lib/utils"
import { hasAnyEnabledLocaleValue } from "@/lib/localized-content"
import type { Language } from "@/lib/i18n-shared"
import { useConfirm } from "@/components/ConfirmDialogProvider"

type BlockRow = { id: string; type: string; order: number; config: string }

interface PageBlocksEditorProps {
  pageId: string
  blocks: BlockRow[]
  enabledLocales: Language[]
}

/** Per-page block list: drag-reorderable cards (delete + inline config editor + explicit save), plus an "add block" row. */
export default function PageBlocksEditor({ pageId, blocks, enabledLocales }: PageBlocksEditorProps) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const router = useRouter()
  const [localBlocks, setLocalBlocks] = useState(blocks)
  const [pendingType, setPendingType] = useState<BlockType>(BLOCK_TYPES[0])
  const [drafts, setDrafts] = useState<Record<string, BlockConfig>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savingAll, setSavingAll] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => { setLocalBlocks(blocks) }, [blocks])

  function configFor(block: BlockRow): BlockConfig {
    return drafts[block.id] ?? parseBlockConfig(block.type as BlockType, block.config)
  }

  function handleConfigChange(blockId: string, config: BlockConfig) {
    setDrafts((prev) => ({ ...prev, [blockId]: config }))
  }

  async function handleSave(block: BlockRow) {
    const config = configFor(block)
    setSavingId(block.id)
    setErrors((prev) => ({ ...prev, [block.id]: "" }))
    const result = await updateBlockConfig(block.id, JSON.stringify(config))
    setSavingId(null)
    if (result.error) {
      setErrors((prev) => ({ ...prev, [block.id]: result.error! }))
      return
    }
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[block.id]
      return next
    })
    router.refresh()
  }

  async function handleDelete(blockId: string) {
    if (!(await confirm(t('admin.pages.deleteBlockConfirm')))) return
    await deleteBlock(blockId)
    router.refresh()
  }

  async function handleAdd() {
    await createBlock(pageId, pendingType)
    router.refresh()
  }

  function handleReorder(orderedIds: string[]) {
    setLocalBlocks((prev) => {
      const byId = new Map(prev.map((b) => [b.id, b]))
      return orderedIds.map((id) => byId.get(id)).filter((b): b is BlockRow => Boolean(b))
    })
    reorderBlocks(pageId, orderedIds).then(() => router.refresh())
  }

  // C-3: no privileged locale — a text block is valid once *any* enabled
  // locale is filled, never specifically `text_pl`.
  const isTextInvalid = (block: BlockRow, config: BlockConfig) => {
    if (block.type !== "text") return false
    const { text_pl, text_en, text_uk } = config as TextBlockConfig
    return !hasAnyEnabledLocaleValue({ pl: text_pl, en: text_en, uk: text_uk }, enabledLocales)
  }

  async function handleSaveAll() {
    const entries = Object.entries(drafts)
    if (entries.length === 0) return
    setSavingAll(true)
    const nextErrors: Record<string, string> = {}
    const savedIds: string[] = []
    for (const [blockId, config] of entries) {
      const block = localBlocks.find((b) => b.id === blockId)
      if (block && isTextInvalid(block, config)) {
        nextErrors[blockId] = t('admin.pages.textRequiredAnyLocale')
        continue
      }
      const result = await updateBlockConfig(blockId, JSON.stringify(config))
      if (result.error) {
        nextErrors[blockId] = result.error
      } else {
        nextErrors[blockId] = ""
        savedIds.push(blockId)
      }
    }
    setErrors((prev) => ({ ...prev, ...nextErrors }))
    setDrafts((prev) => {
      const next = { ...prev }
      savedIds.forEach((id) => delete next[id])
      return next
    })
    setSavingAll(false)
    router.refresh()
  }

  const draftCount = Object.keys(drafts).length
  const ids = localBlocks.map((b) => b.id)

  return (
    <div className="flex flex-col gap-4">
      {localBlocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">{t('admin.pages.noBlocksTitle')}</p>
        </div>
      ) : (
        <SortableList ids={ids} onReorder={handleReorder}>
          {(id, handle) => {
            const block = localBlocks.find((b) => b.id === id)
            if (!block) return null
            const config = configFor(block)
            const invalid = isTextInvalid(block, config)
            return (
              <div
                ref={handle.setNodeRef}
                style={handle.style}
                className={cn(
                  "rounded-[20px] border border-border bg-card shadow-sm p-4 flex flex-col gap-3",
                  handle.isDragging && "relative z-10 shadow-md"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      {...handle.attributes}
                      {...handle.listeners}
                      aria-label={t('admin.pages.dragHandleLabel')}
                      title={t('admin.pages.dragHandleLabel')}
                      className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <p className="text-sm font-medium">{t(`admin.pages.blockType.${block.type}`)}</p>
                  </div>
                  <Button variant="ghost" size="icon-sm" className="hover:text-destructive" onClick={() => handleDelete(block.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <BlockConfigEditor
                  type={block.type as BlockType}
                  config={config}
                  onChange={(next) => handleConfigChange(block.id, next)}
                  enabledLocales={enabledLocales}
                />

                {errors[block.id] && <p className="text-xs text-destructive">{errors[block.id]}</p>}

                <Button
                  size="sm"
                  className="self-start"
                  disabled={savingId === block.id || invalid}
                  onClick={() => handleSave(block)}
                >
                  {savingId === block.id ? t('common.saving') : t('admin.pages.saveBlockBtn')}
                </Button>
              </div>
            )
          }}
        </SortableList>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-[20px] border border-dashed border-border p-4">
        <BlockTypePicker
          value={pendingType}
          onChange={(type) => type !== "none" && setPendingType(type)}
          allowed={[...BLOCK_TYPES]}
          className="h-9 max-w-xs"
        />
        <Button variant="outline" className="gap-1.5" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          {t('admin.pages.addBlockBtn')}
        </Button>
      </div>

      {/* Floating "Save all" — mirrors SettingsForm.tsx's page-level Save FAB
          (same fixed bottom-right circular button, primary/muted treatment),
          shown at all breakpoints since this page has no sidebar equivalent. */}
      <button
        type="button"
        onClick={handleSaveAll}
        disabled={draftCount === 0 || savingAll}
        aria-label={t('admin.pages.saveAllBtn')}
        title={t('admin.pages.saveAllBtn')}
        className={cn(
          "fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all",
          draftCount > 0 && !savingAll
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-muted-foreground opacity-50 pointer-events-none"
        )}
      >
        <Save className="h-5 w-5" />
      </button>
    </div>
  )
}
