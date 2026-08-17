import SettingsSection from '../shared/SettingsSection'

const fieldClass =
  'w-full h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed'
const textareaClass =
  'w-full min-h-[120px] rounded-md border border-input bg-muted/30 px-3 py-2 text-sm font-mono text-muted-foreground cursor-not-allowed resize-none'

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

// Ported from the real src/app/admin/settings/social/page.tsx +
// SocialSettingsForm.tsx. All fields blank/disabled — this demo's "Loom &
// Blade" tenant uses only credentials/password login, no social auth
// configured. No fetch/localStorage anywhere; Save Config has nothing to
// persist so it's shown disabled.
export default function SocialAuthPage() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Configuration</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill in keys to automatically enable social logins. Leave everything blank to disable a provider. Secrets
          are encrypted securely in the database.
        </p>
      </div>

      <SettingsSection
        title="Google Auth"
        description="Get these credentials from the Google Cloud Console (APIs & Services -> Credentials)."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Client ID" placeholder="123456...apps.googleusercontent.com" />
          <Field label="Client Secret" placeholder="GOCSPX-..." type="password" />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Telegram Auth"
        description="Talk to @BotFather in Telegram, create a bot and map your domain via /setdomain."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="Bot Username"
            placeholder="my_salon_auth_bot"
            description="Exclude the @ symbol. Note: If the bot username is invalid or if testing on localhost, the widget might display &quot;Username invalid&quot;. If so, verify double-check BotFather configuration and register your domain."
          />
          <Field label="Bot Token" placeholder="123456:ABC-DEF123..." type="password" description="Encrypted on save." />
        </div>
      </SettingsSection>

      <SettingsSection title="Apple Auth" description="Requires an active Apple Developer Program membership.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Services ID (Client ID)" placeholder="com.example.salon.auth" />
          <Field label="Team ID" placeholder="10-character Team ID" />
          <Field label="Key ID" placeholder="10-character Key ID" />
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Private Key (.p8 contents)</label>
            <textarea
              disabled
              placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
              className={textareaClass}
            />
            <p className="text-xs text-muted-foreground">
              Paste the entire contents of the .p8 file you downloaded. Encrypted on save.
            </p>
          </div>
        </div>
      </SettingsSection>

      <div className="flex border-t border-border pt-4">
        <button
          disabled
          className="h-10 rounded-md bg-muted px-5 text-sm font-medium text-muted-foreground cursor-not-allowed"
        >
          Save Config
        </button>
      </div>
    </div>
  )
}
