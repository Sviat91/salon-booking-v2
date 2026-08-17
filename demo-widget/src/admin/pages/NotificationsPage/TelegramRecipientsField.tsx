import { Plus, Trash2 } from 'lucide-react'

const fieldClass =
  'flex-1 h-9 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed'

// Structural, inert port of TelegramRecipientsField.tsx — a handful of mock
// recipient rows (chat ID + optional label), a disabled Trash icon per row,
// and an inert "+ Add recipient" affordance that doesn't append anything
// (nothing here writes to any list, mock or otherwise).
const mockRecipients = [
  { chatId: '123456789', label: 'Front desk' },
  { chatId: '-1001234567890', label: 'Team group' },
  { chatId: '987654321', label: '' },
]

export default function TelegramRecipientsField() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium leading-none text-foreground">Notification recipients</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Chat IDs that will receive Telegram notifications for new bookings and contact form submissions.
        </p>
      </div>

      <div className="space-y-2">
        {mockRecipients.map((r) => (
          <div key={r.chatId} className="flex items-center gap-2">
            <input disabled defaultValue={r.chatId} placeholder="Chat ID, e.g. 123456789" className={fieldClass} />
            <input disabled defaultValue={r.label} placeholder="Label (optional)" className={fieldClass} />
            <button
              disabled
              aria-label="Remove recipient"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="h-8 inline-flex items-center gap-1 rounded-md border border-input bg-transparent px-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add recipient
      </button>

      <p className="text-[0.8rem] text-muted-foreground">
        To add a group: add the bot to your Telegram group, send any message, then open{' '}
        <code>https://api.telegram.org/bot[YOUR_BOT_TOKEN]/getUpdates</code> and copy the negative{' '}
        <code>chat.id</code> (e.g. -1001234567890).
      </p>
    </div>
  )
}
