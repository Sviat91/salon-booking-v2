"use client"

import { useState, useCallback, useTransition } from "react"
import Image from "next/image"
import { Plus, Pencil, Trash2, Mail, Eye, EyeOff, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import MasterForm from "./MasterForm"
import { deleteMaster } from "./actions"

type Master = {
  id: string
  name: string | null
  email: string | null
  masterProfile: { bio: string | null; avatarUrl: string | null; showOnHomepage: boolean } | null
}

export default function MastersClient({ masters }: { masters: Master[] }) {
  const [editTarget, setEditTarget] = useState<Master | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [, startTransition] = useTransition()

  const handleDelete = useCallback((id: string, name: string | null) => {
    if (!confirm(`Delete master "${name ?? "this master"}"? This cannot be undone.`))
      return
    startTransition(() => {
      deleteMaster(id)
    })
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Masters</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {masters.length} master{masters.length !== 1 ? "s" : ""} registered
          </p>
        </div>

        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger
            render={
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Master
              </Button>
            }
          />
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Add Master</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <MasterForm onSuccess={() => setAddOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {masters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No masters yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click &ldquo;Add Master&rdquo; to register the first one.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {masters.map((master) => (
            <div
              key={master.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            >
              {/* Avatar + name */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative h-10 w-10 rounded-full overflow-hidden border border-border bg-muted shrink-0 flex items-center justify-center">
                    {master.masterProfile?.avatarUrl ? (
                      <Image
                        src={master.masterProfile.avatarUrl}
                        alt={master.name ?? ""}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm leading-tight">
                        {master.name ?? "—"}
                      </p>
                      {/* Homepage visibility badge */}
                      {master.masterProfile?.showOnHomepage ? (
                        <span className="flex items-center gap-0.5 rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                          <Eye className="h-2.5 w-2.5" />Visible
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          <EyeOff className="h-2.5 w-2.5" />Hidden
                        </span>
                      )}
                    </div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Mail className="h-3 w-3" />
                      {master.email}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
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
                        <SheetTitle>Edit Master</SheetTitle>
                      </SheetHeader>
                      <div className="px-4 pb-4">
                        {editTarget && (
                          <MasterForm
                            master={editTarget}
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

              {/* Bio */}
              {master.masterProfile?.bio && (
                <p className="text-xs text-muted-foreground line-clamp-2 border-t border-border pt-2">
                  {master.masterProfile.bio}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
