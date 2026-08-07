import { z } from 'zod'

// `dbId: null` marks a recipient added this session but not yet persisted —
// distinguishes "create" from "already exists" when diffing on save.
// `chatId` may be empty — the field array always keeps one blank editable
// slot on screen (see TelegramRecipientsField.tsx); blank rows are filtered
// out on save, never sent to the API, so this schema doesn't reject them.
export const recipientSchema = z.object({
  dbId: z.string().nullable(),
  chatId: z.string().trim().max(64),
  label: z.string().trim().max(64).optional(),
})

export type RecipientRow = z.infer<typeof recipientSchema>
