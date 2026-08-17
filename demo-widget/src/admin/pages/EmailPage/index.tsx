import { useState } from 'react'
import SettingsSection from '../../shared/SettingsSection'
import Switch from '../../shared/Switch'
import Dialog from '../../shared/Dialog'
import SmtpInstructions from './SmtpInstructions'

const fieldClass =
  'w-full h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed'

function Field({
  label,
  placeholder,
  type = 'text',
  description,
}: {
  label: string
  placeholder?: string
  type?: string
  description?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input disabled type={type} placeholder={placeholder} className={fieldClass} />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

// Ported from the real src/app/admin/settings/email/page.tsx +
// EmailSettingsForm.tsx. Represents a salon that hasn't configured SMTP yet
// (the real default state) — every field blank/placeholder and disabled. No
// fetch/localStorage anywhere: "Save Config" has nothing to persist so it's
// shown disabled; "Save & Send Test Email" only opens the local Dialog below,
// whose "Send Email" button closes the dialog and nothing else.
export default function EmailPage() {
  const [testDialogOpen, setTestDialogOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Configuration</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure how the application sends emails for password resets, booking confirmations, and other
          notifications.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <SettingsSection title="SMTP Server" description="Server credentials used to send transactional email.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="SMTP Host" placeholder="smtp.gmail.com" />
              <Field label="SMTP Port" placeholder="587" description="Usually 587 (STARTTLS) or 465 (SSL)" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="SMTP Username / Email" placeholder="user@example.com" />
              <Field label="SMTP Password" placeholder="App Password" type="password" />
            </div>

            <Field
              label="Sender Display Name (From)"
              placeholder="Salon Beauty <info@salon-beauty.com>"
              description="Format: Name <email@domain.com>"
            />

            <div className="flex flex-row items-center justify-between rounded-[20px] border border-border bg-muted/30 p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Secure Connection (SSL)</p>
                <p className="text-xs text-muted-foreground">
                  Enable this if your port is 465. Keep disabled (false) for port 587 (STARTTLS).
                </p>
              </div>
              <Switch checked={false} onChange={() => {}} disabled />
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-border">
              <button
                disabled
                className="h-10 w-full sm:w-auto rounded-md bg-muted px-5 text-sm font-medium text-muted-foreground cursor-not-allowed"
              >
                Save Config
              </button>
              <button
                type="button"
                onClick={() => setTestDialogOpen(true)}
                className="h-10 w-full sm:w-auto rounded-md border border-input bg-transparent px-5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Save & Send Test Email
              </button>
            </div>
          </SettingsSection>
        </div>

        <div className="lg:col-span-1">
          <SmtpInstructions />
        </div>
      </div>

      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} title="Send Test Email">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Enter an email address to receive a test message. This will save your current settings and test the
            connection.
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input disabled placeholder="test@example.com" className={fieldClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setTestDialogOpen(false)}
              className="h-9 rounded-md border border-input bg-transparent px-4 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setTestDialogOpen(false)}
              className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Send Email
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
