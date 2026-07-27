"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useTranslation } from "react-i18next"
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import DataCard from "@/components/admin/DataCard"
import PageFormSheet from "./PageFormSheet"
import SortableList from "./SortableList"
import { deletePage, reorderPages, togglePageEnabled } from "@/app/admin/pages/actions"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { resolveLocalized } from "@/lib/localized-content"
import { PAGE_VISIBILITY_TARGETS, parseVisibility, type PageOwner } from "@/lib/content/pages-shared"
import { cn } from "@/lib/utils"
import type { Language } from "@/lib/i18n-shared"
import { useConfirm } from "@/components/ConfirmDialogProvider"

export type PageWithBlocks = {
  id: string
  slug: string
  title_pl: string | null
  title_en: string | null
  title_uk: string | null
  enabled: boolean
  order: number
  visibility: string | null
  blocks: { id: string }[]
}

interface PageListClientProps {
  pages: PageWithBlocks[]
  /** Authorization payload forwarded verbatim to createPage/reorderPages. */
  owner: PageOwner
  /** UI copy variant only — never used for authorization. */
  scope: "global" | "master" | "master-as-admin"
  /** Only read by the "master-as-admin" header copy. */
  masterName?: string
  enabledLocales: Language[]
  detailHrefBase: string
}

const SCOPE_COPY = {
  global:            { eyebrow: 'admin.pages.globalEyebrow',      desc: 'admin.pages.globalDesc' },
  master:            { eyebrow: 'admin.pages.masterEyebrow',      desc: 'admin.pages.masterDesc' },
  "master-as-admin": { eyebrow: 'admin.pages.masterAdminEyebrow', desc: 'admin.pages.masterAdminDesc' },
} as const

/** Shared list surface for `/admin/pages`, `/admin/master/pages`, and `/admin/masters/[masterId]/pages` (AD-5, one implementation for all three owners/surfaces). */
export default function PageListClient({ pages, owner, scope, masterName, enabledLocales, detailHrefBase }: PageListClientProps) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const language = useCurrentLanguage()
  const displayTitle = (p: PageWithBlocks) =>
    resolveLocalized({ pl: p.title_pl, en: p.title_en, uk: p.title_uk }, language)
  const [localPages, setLocalPages] = useState(pages)
  const [editTarget, setEditTarget] = useState<PageWithBlocks | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => { setLocalPages(pages) }, [pages])

  const handleDelete = useCallback(async (id: string) => {
    if (!(await confirm(t('admin.pages.deletePageConfirm')))) return
    startTransition(() => { deletePage(id) })
  }, [t, confirm])

  const handleToggle = useCallback((id: string, enabled: boolean) => {
    startTransition(() => { togglePageEnabled(id, !enabled) })
  }, [])

  const handleReorder = useCallback((orderedIds: string[]) => {
    setLocalPages((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]))
      return orderedIds.map((id) => byId.get(id)).filter((p): p is PageWithBlocks => Boolean(p))
    })
    startTransition(() => { reorderPages(orderedIds, owner) })
  }, [owner])

  const visibilityBadges = (p: PageWithBlocks) => {
    const ids = parseVisibility(p.visibility)
    const targets = PAGE_VISIBILITY_TARGETS.filter((target) => ids.includes(target.id))
    if (targets.length === 0) return <span className="text-muted-foreground">—</span>
    return (
      <div className="flex flex-wrap gap-1">
        {targets.map((target) => (
          <Badge key={target.id} variant="muted" className="text-[11px]">{t(target.labelKey)}</Badge>
        ))}
      </div>
    )
  }

  const enabledBadge = (p: PageWithBlocks) => (
    <button type="button" onClick={() => handleToggle(p.id, p.enabled)}>
      {p.enabled ? (
        <Badge variant="success">{t('admin.pages.enabledBadge')}</Badge>
      ) : (
        <Badge variant="muted">{t('admin.pages.disabledBadge')}</Badge>
      )}
    </button>
  )

  // Exactly one entry point per row (C-2): Pencil opens the shared edit Sheet
  // (which itself links to the block manager, see PageFormSheet). Delete is a
  // separate destructive action and the drag handle a separate drag affordance —
  // neither counts as a second "entry point".
  const renderActions = (p: PageWithBlocks) => (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon-sm" onClick={() => { setEditTarget(p); setEditOpen(true) }}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="hover:text-destructive"
        onClick={() => handleDelete(p.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )

  const ids = localPages.map((p) => p.id)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            {t(SCOPE_COPY[scope].eyebrow)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(SCOPE_COPY[scope].desc, { name: masterName ?? '' })}
          </p>
        </div>

        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger
            render={
              <Button className="h-10 gap-2 px-5">
                <Plus className="h-4 w-4" />
                {t('admin.pages.addPageTrigger')}
              </Button>
            }
          />
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>{t('admin.pages.addPageTitle')}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <PageFormSheet
                owner={owner}
                scope={scope}
                enabledLocales={enabledLocales}
                detailHrefBase={detailHrefBase}
                onSuccess={() => setAddOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {localPages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">{t('admin.pages.noPagesTitle')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('admin.pages.noPagesHint', { title: t('admin.pages.addPageTitle') })}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden lg:block rounded-[20px] border border-border bg-card shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="w-8 px-2 py-2.5" />
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.pages.colTitle')}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.pages.colSlug')}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.pages.colBlocks')}</th>
                  {scope === "global" && (
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.pages.colVisibility')}</th>
                  )}
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.pages.colEnabled')}</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('admin.pages.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <SortableList ids={ids} onReorder={handleReorder}>
                  {(id, handle) => {
                    const p = localPages.find((x) => x.id === id)
                    if (!p) return null
                    return (
                      <tr
                        ref={handle.setNodeRef}
                        style={handle.style}
                        className={cn("hover:bg-muted/40 transition-colors", handle.isDragging && "relative z-10 bg-card shadow-md")}
                      >
                        <td className="px-2 py-3">
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
                        </td>
                        <td className="px-4 py-3 font-medium">{displayTitle(p)}</td>
                        <td className="px-4 py-3 text-muted-foreground">/{p.slug}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.blocks.length}</td>
                        {scope === "global" && (
                          <td className="px-4 py-3 text-xs text-muted-foreground">{visibilityBadges(p)}</td>
                        )}
                        <td className="px-4 py-3">{enabledBadge(p)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end">
                            {renderActions(p)}
                          </div>
                        </td>
                      </tr>
                    )
                  }}
                </SortableList>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 lg:hidden">
            <SortableList ids={ids} onReorder={handleReorder}>
              {(id, handle) => {
                const p = localPages.find((x) => x.id === id)
                if (!p) return null
                return (
                  <div
                    ref={handle.setNodeRef}
                    style={handle.style}
                    className={cn("flex items-start gap-2", handle.isDragging && "relative z-10")}
                  >
                    <button
                      type="button"
                      {...handle.attributes}
                      {...handle.listeners}
                      aria-label={t('admin.pages.dragHandleLabel')}
                      title={t('admin.pages.dragHandleLabel')}
                      className="mt-4 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <DataCard
                      className="flex-1"
                      title={displayTitle(p)}
                      fields={[
                        { label: t('admin.pages.colSlug'), value: `/${p.slug}` },
                        { label: t('admin.pages.colBlocks'), value: p.blocks.length },
                        ...(scope === "global" ? [{ label: t('admin.pages.colVisibility'), value: visibilityBadges(p) }] : []),
                        { label: t('admin.pages.colEnabled'), value: enabledBadge(p) },
                      ]}
                      actions={renderActions(p)}
                    />
                  </div>
                )
              }}
            </SortableList>
          </div>
        </>
      )}

      <Sheet
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o)
          if (!o) setEditTarget(null)
        }}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{t('admin.pages.editPageTitle')}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            {editTarget && (
              <PageFormSheet
                page={editTarget}
                owner={owner}
                scope={scope}
                enabledLocales={enabledLocales}
                detailHrefBase={detailHrefBase}
                onSuccess={() => {
                  setEditOpen(false)
                  setEditTarget(null)
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
