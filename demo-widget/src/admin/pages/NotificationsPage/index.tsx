import type { ReactNode } from 'react'
import SettingsSection from '../../shared/SettingsSection'
import Switch from '../../shared/Switch'
import TelegramRecipientsField from './TelegramRecipientsField'

const fieldClass =
  'w-full h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed'

function ToggleRow({ label, description }: { label: string; description?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-none text-foreground">{label}</p>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground w-7 text-right">Off</span>
        <Switch checked={false} onChange={() => {}} disabled />
      </div>
    </div>
  )
}

// Ported from the real src/app/admin/settings/notifications/page.tsx +
// NotificationSettingsForm.tsx + TelegramRecipientsField.tsx. Represents the
// unconfigured default state (both channels off, reminders off, SMTP not
// configured — matches EmailPage.tsx being blank). No fetch/localStorage
// anywhere; "Save Settings" has nothing to persist so it's shown disabled.
export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Configuration</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure email and Telegram channels for booking confirmations, reminders, and contact form alerts.
        </p>
      </div>

      <SettingsSection
        title="Email"
        description="Send booking confirmations and reminders by email. Requires SMTP configured under Email Settings."
      >
        <ToggleRow
          label="Send email notifications"
          description={
            <span className="text-destructive font-medium">
              SMTP not configured — go to <span className="underline">Email Settings</span> first.
            </span>
          }
        />
      </SettingsSection>

      <SettingsSection
        title="Telegram"
        description="Admin alerts for new bookings and contact form submissions via a Telegram bot."
      >
        <ToggleRow
          label="Send Telegram notifications"
          description="Admin alerts for new bookings and contact form submissions."
        />

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Bot Token</label>
          <input disabled type="password" placeholder="1234567890:ABCdef..." className={fieldClass} />
          <p className="text-xs text-muted-foreground">
            Get it from <code>@BotFather</code> → /newbot or /mybots.
          </p>
        </div>

        <TelegramRecipientsField />
      </SettingsSection>

      <SettingsSection
        title="Reminders"
        description="Automated appointment reminders, sent on the channels enabled above."
      >
        <p className="text-sm text-muted-foreground">Enable at least one channel above to activate reminders.</p>

        <ToggleRow label="24-hour reminder" description="Remind clients one day before their appointment." />
        <ToggleRow label="2-hour reminder" description="Remind clients two hours before their appointment." />
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
