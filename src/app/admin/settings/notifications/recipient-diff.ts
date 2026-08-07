import type { RecipientRow } from './recipient-schema'

// Diff the current recipients field-array against the last-loaded/last-saved
// baseline. Blank rows (chatId trims to '') are the always-present empty
// slot — never created, and treated the same as a removed row for deletion.
//
// The loose `BaselineRecipient` shape is required because
// `form.formState.defaultValues` is typed `DeepPartial<FormValues>`.
export type BaselineRecipient = { dbId?: string | null; chatId?: string; label?: string } | undefined

export function diffRecipients(
  baseline: readonly BaselineRecipient[],
  current: readonly RecipientRow[]
): { toCreate: RecipientRow[]; toUpdate: RecipientRow[]; toDeleteIds: string[] } {
  const filledByDbId = new Map(
    current.filter((r) => r.dbId && r.chatId.trim()).map((r) => [r.dbId, r])
  )
  const toCreate = current.filter((r) => r.dbId === null && r.chatId.trim())
  const toDeleteIds = baseline
    .filter((r) => r?.dbId && !filledByDbId.has(r.dbId))
    .map((r) => r!.dbId as string)
  const toUpdate = [...filledByDbId.values()].filter((r) => {
    const base = baseline.find((b) => b?.dbId === r.dbId)
    return base && (base.chatId !== r.chatId || (base.label || '') !== (r.label || ''))
  })

  return { toCreate, toUpdate, toDeleteIds }
}
