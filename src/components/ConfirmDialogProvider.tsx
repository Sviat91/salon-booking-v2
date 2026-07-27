"use client"

// Placement rationale: src/contexts/ holds framework-state-only providers
// that render no DOM (LanguageContext.tsx, MasterContext.tsx); this one
// renders a portalled dialog and imports ui/ primitives, so it belongs
// under src/components/.

import * as React from "react"
import { useTranslation } from "react-i18next"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export type ConfirmOptions = {
  /** Dialog heading. Defaults to `common.confirmTitle`. */
  title?: string
  /** Label of the confirming button. Defaults to `common.confirm`. */
  confirmLabel?: string
  /** Confirming button uses the `destructive` variant. Defaults to `true` —
   *  every current call site is a delete/erase/cancel action. */
  destructive?: boolean
}
/** Async drop-in for `window.confirm`. `message` must already be translated. */
export type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>

const ConfirmContext = React.createContext<ConfirmFn | null>(null)
type PendingRequest = { message: string; options: ConfirmOptions }

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [request, setRequest] = React.useState<PendingRequest | null>(null)
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null)

  const confirm = React.useCallback<ConfirmFn>(
    (message, options = {}) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current?.(false) // a new request supersedes an unanswered one
        resolverRef.current = resolve
        setRequest({ message, options })
        setOpen(true)
      }),
    []
  )

  const settle = React.useCallback((result: boolean) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setOpen(false)
    resolve?.(result)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(next) => { if (!next) settle(false) }}
        // keep the message mounted through the close animation
        onOpenChangeComplete={(next) => { if (!next) setRequest(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.options.title ?? t('common.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {request?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              {t('common.cancel')}
            </AlertDialogClose>
            <Button
              variant={request?.options.destructive === false ? "default" : "destructive"}
              onClick={() => settle(true)}
            >
              {request?.options.confirmLabel ?? t('common.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const confirm = React.useContext(ConfirmContext)
  if (!confirm) throw new Error("useConfirm must be used within a ConfirmDialogProvider")
  return confirm
}
