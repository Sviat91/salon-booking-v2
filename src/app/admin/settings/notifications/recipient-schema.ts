import { z } from 'zod'

// `dbId: null` marks a recipient added this session but not yet persisted —
// distinguishes "create" from "already exists" when diffing on save.
export const recipientSchema = z.object({
  dbId: z.string().nullable(),
  chatId: z.string().trim().min(1).max(64),
  label: z.string().trim().max(64).optional(),
})

export type RecipientRow = z.infer<typeof recipientSchema>
