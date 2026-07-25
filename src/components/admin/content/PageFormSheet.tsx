"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useFormState, useFormStatus } from "react-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import LocalizedFieldInput from "@/components/admin/LocalizedFieldInput"
import { createPage, updatePage, type PageFormState } from "@/app/admin/pages/actions"
import { PAGE_VISIBILITY_TARGETS, parseVisibility, serializeVisibility } from "@/lib/content/pages-shared"
import type { Language } from "@/lib/i18n-shared"
import type { PageWithBlocks } from "./PageListClient"

interface PageFormSheetProps {
  page?: PageWithBlocks
  scope: "global" | "master"
  enabledLocales: Language[]
  detailHrefBase: string
  onSuccess: () => void
}

const initialState: PageFormState = {}

function SubmitButton({ label }: { label: string }) {
  const { t } = useTranslation()
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="mt-2">
      {pending ? t('common.saving') : label}
    </Button>
  )
}

export default function PageFormSheet({ page, scope, enabledLocales, detailHrefBase, onSuccess }: PageFormSheetProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const action = page ? updatePage.bind(null, page.id) : createPage
  const [state, formAction] = useFormState(action, initialState)
  const [visibility, setVisibility] = useState<string[]>(parseVisibility(page?.visibility))

  useEffect(() => {
    if (!state.success) return
    // Creating a page has nothing to configure yet but blocks — skip the
    // "create, close, reopen, click into blocks" round trip and go straight
    // to the block editor. Editing an existing page keeps the explicit
    // "Manage blocks →" button below instead (unsaved-edit-loss concern
    // doesn't apply on create, since there's nothing else to lose yet).
    if (!page && state.pageId) {
      router.push(`${detailHrefBase}/${state.pageId}`)
      return
    }
    onSuccess()
  }, [state.success, state.pageId, page, detailHrefBase, router, onSuccess])

  function toggleVisibility(id: string, checked: boolean) {
    setVisibility((prev) => (checked ? [...prev, id] : prev.filter((v) => v !== id)))
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <LocalizedFieldInput
        baseName="title"
        label={t('admin.pages.pageTitleLabel')}
        values={{ pl: page?.title_pl, en: page?.title_en, uk: page?.title_uk }}
        enabledLocales={enabledLocales}
        placeholder={t('admin.pages.pageTitlePlaceholder')}
        errors={{ pl: state.fieldErrors?.title_pl?.[0] }}
      />
      {/* C-3: no locale is privileged — the rule is "at least one enabled locale filled". */}
      <p className="text-xs text-muted-foreground -mt-2">{t('admin.pages.anyLocaleRequiredHint')}</p>

      <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
        <input
          id="enabled"
          name="enabled"
          type="checkbox"
          defaultChecked={page?.enabled ?? true}
          className="h-4 w-4 accent-primary shrink-0"
        />
        <Label htmlFor="enabled" className="cursor-pointer text-sm font-medium">
          {t('admin.pages.enabledLabel')}
        </Label>
      </div>

      {scope === "global" && (
        <div className="grid gap-2">
          <Label>{t('admin.pages.visibilityLabel')}</Label>
          <div className="flex flex-wrap gap-4">
            {PAGE_VISIBILITY_TARGETS.map((target) => (
              <label key={target.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={visibility.includes(target.id)}
                  onCheckedChange={(checked: boolean) => toggleVisibility(target.id, checked)}
                />
                <span className="text-sm">{t(target.labelKey)}</span>
              </label>
            ))}
          </div>
          <input type="hidden" name="visibility" value={serializeVisibility(visibility)} />
        </div>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton label={page ? t('admin.pages.saveChangesBtn') : t('admin.pages.createPageBtn')} />

      {page && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Button variant="outline" render={<Link href={`${detailHrefBase}/${page.id}`} />}>
            {t('admin.pages.manageBlocksBtn')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('admin.pages.manageBlocksHint')}
          </p>
        </div>
      )}
    </form>
  )
}
