import SettingsSection from '../shared/SettingsSection'
import Switch from '../shared/Switch'

const fieldClass =
  'w-full h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed'

// Ported from the real src/app/admin/settings/client-bot/page.tsx +
// ClientBotSettingsForm.tsx.
//
// NOTE: this "Booking bot" is a client-facing Telegram chat-booking bot
// (grammy-based long polling in the real backend) — clients message it to
// book an appointment directly in chat. It is NOT related to n8n or any
// webhook automation; the real app has no n8n integration on this page at
// all. This distinction was a documented point of confusion earlier in this
// project's planning, noted here so it doesn't get re-introduced.
//
// All fields disabled/blank (bot not configured yet). No fetch/localStorage
// anywhere; "Save Settings" has nothing to persist so it's shown disabled.
export default function ClientBotPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Configuration</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the interactive Telegram bot that lets clients book appointments directly in chat.
        </p>
      </div>

      <SettingsSection
        title="Booking bot"
        description="A separate Telegram bot (own token) for interactive client booking. No public URL or tunnel needed — works immediately, locally and on the server."
      >
        <div className="flex items-center justify-between gap-4 py-1">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-none text-foreground">Enable booking bot</p>
            <p className="mt-1 text-xs text-muted-foreground">
              When enabled, the bot replies to messages and lets clients book an appointment in chat.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground w-7 text-right">Off</span>
            <Switch checked={false} onChange={() => {}} disabled />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Bot token</label>
          <input disabled type="password" placeholder="1234567890:ABCdef..." className={fieldClass} />
          <p className="text-xs text-muted-foreground">
            Get it from <code>@BotFather</code> → /newbot or /mybots.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Bot username (@username)</label>
          <input disabled placeholder="e.g. my_salon_bot" className={fieldClass} />
          <p className="text-xs text-muted-foreground">
            The bot's technical @username from @BotFather — always ends in "bot" (e.g. my_salon_bot). This is NOT
            the bot's display name, which is a separate setting in BotFather.
          </p>
          <span className="text-xs underline text-muted-foreground">Open bot in Telegram →</span>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Website URL</label>
          <input disabled placeholder="https://my-salon.com" className={fieldClass} />
          <p className="text-xs text-muted-foreground">
            Shown as the terms & privacy links in the bot's consent message and as the "Open website" button after a
            successful booking. Optional — leave empty to fall back to the server's site URL.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection title="How to set up" description="A few steps to get the booking bot running.">
        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
          <li>
            Create a bot with <code>@BotFather</code> on Telegram and copy its token.
          </li>
          <li>Paste the token above and save.</li>
          <li>Enable the bot above and save again.</li>
          <li>Done — no public URL or domain is required. Send /start to the bot to test it.</li>
        </ol>
      </SettingsSection>

      <div className="flex border-t border-border pt-4">
        <button
          disabled
          className="h-10 rounded-md bg-muted px-5 text-sm font-medium text-muted-foreground cursor-not-allowed"
        >
          Save Settings
        </button>
      </div>
    </div>
  )
}
