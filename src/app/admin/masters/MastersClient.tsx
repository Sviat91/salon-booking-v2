"use client"

import { useState, useCallback, useTransition } from "react"
import { useTranslation } from "react-i18next"
import Image from "next/image"
import { Plus, Pencil, Trash2, Eye, EyeOff, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import MasterForm from "./MasterForm"
import { deleteMaster } from "./actions"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { resolveLocalized } from "@/lib/localized-content"
import type { Language } from "@/lib/i18n-shared"

type Master = {
  id: string
  name: string | null
  email: string | null
  masterProfile: {
    bio_pl: string | null
    bio_en: string | null
    bio_uk: string | null
    avatarUrl: string | null
    showOnHomepage: boolean
    color: string | null
  } | null
}

export default function MastersClient({ masters, enabledLocales }: { masters: Master[]; enabledLocales: Language[] }) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const displayBio = (master: Master) =>
    master.masterProfile
      ? resolveLocalized(
          { pl: master.masterProfile.bio_pl, en: master.masterProfile.bio_en, uk: master.masterProfile.bio_uk },
          language
        )
      : ""
  const [editTarget, setEditTarget] = useState<Master | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [, startTransition] = useTransition()

  const handleDelete = useCallback((id: string, name: string | null) => {
    if (!confirm(t('admin.masters.deleteConfirm', { name: name ?? t('admin.masters.thisMaster') })))
      return
    startTransition(() => {
      deleteMaster(id)
    })
  }, [t])

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            {t('admin.masters.staffEyebrow')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('admin.masters.staffDesc')}
          </p>
        </div>

        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger
            render={
              <Button className="h-10 gap-2 px-5">
                <Plus className="h-4 w-4" />
                {t('admin.masters.addMasterTrigger')}
              </Button>
            }
          />
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>{t('admin.masters.addMasterTitle')}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <MasterForm enabledLocales={enabledLocales} onSuccess={() => setAddOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {masters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">{t('admin.masters.noMastersTitle')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('admin.masters.noMastersHint', { title: t('admin.masters.addMasterTitle') })}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {masters.map((master) => (
            <div
              key={master.id}
              className="flex items-center gap-4 rounded-[20px] border border-border bg-card p-4 shadow-sm"
            >
              {/* Avatar (ringed in the master's own color) */}
              <div
                className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full bg-muted flex items-center justify-center"
                style={{
                  boxShadow: `0 0 0 3px ${master.masterProfile?.color ?? "#166534"}`,
                }}
              >
                {master.masterProfile?.avatarUrl ? (
                  <Image
                    src={master.masterProfile.avatarUrl}
                    alt={master.name ?? ""}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <User className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              {/* Name / email / bio */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-[15px] font-medium text-foreground">
                  {master.name ?? "—"}
                </p>
                <p className="truncate text-xs text-muted-foreground mt-0.5">
                  {master.email}
                </p>
                {displayBio(master) && (
                  <p className="truncate text-xs text-muted-foreground/80 mt-0.5">
                    {displayBio(master)}
                  </p>
                )}
              </div>

              {/* Visibility pill */}
              <div className="shrink-0">
                {master.masterProfile?.showOnHomepage ? (
                  <Badge variant="success" className="gap-1">
                    <Eye className="h-3 w-3" />
                    {t('admin.masters.visible')}
                  </Badge>
                ) : (
                  <Badge variant="muted" className="gap-1">
                    <EyeOff className="h-3 w-3" />
                    {t('admin.masters.hidden')}
                  </Badge>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <Sheet
                  open={editOpen && editTarget?.id === master.id}
                  onOpenChange={(o) => {
                    setEditOpen(o)
                    if (!o) setEditTarget(null)
                  }}
                >
                  <SheetTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditTarget(master)
                          setEditOpen(true)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                  <SheetContent side="right">
                    <SheetHeader>
                      <SheetTitle>{t('admin.masters.editMasterTitle')}</SheetTitle>
                    </SheetHeader>
                    <div className="px-4 pb-4">
                      {editTarget && (
                        <MasterForm
                          master={editTarget}
                          enabledLocales={enabledLocales}
                          onSuccess={() => {
                            setEditOpen(false)
                            setEditTarget(null)
                          }}
                        />
                      )}
                    </div>
                  </SheetContent>
                </Sheet>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:text-destructive"
                  onClick={() => handleDelete(master.id, master.name)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
