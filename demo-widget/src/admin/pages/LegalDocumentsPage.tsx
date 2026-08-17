import SettingsSection from '../shared/SettingsSection'
import { termsContent, privacyContent } from '../../lib/legalContent'

const textareaClass =
  'w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed resize-none'

// Ported from the real src/app/admin/settings/legal/page.tsx +
// LegalSettingsForm.tsx. The textareas are pre-filled with this demo's own
// real Terms/Privacy copy (src/lib/legalContent.ts — the same text rendered
// on the public /terms and /privacy pages), not invented text, matching what
// a real salon owner would already have saved. Disabled — no
// fetch/localStorage anywhere.
export default function LegalDocumentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Configuration</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the Terms of Use and Privacy Policy text shown publicly on the /terms and /privacy pages.
        </p>
      </div>

      <SettingsSection title="Terms of Use" description="Content of the Terms of Use shown on the /terms page.">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Document content</label>
          <textarea disabled rows={20} defaultValue={termsContent} className={textareaClass} />
        </div>
        <p className="text-xs text-muted-foreground">
          Supported formatting: "## Heading", "### Subheading", "- list item", and "**bold**". Everything else
          renders as plain text.
        </p>
      </SettingsSection>

      <SettingsSection title="Privacy Policy" description="Content of the Privacy Policy shown on the /privacy page.">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Document content</label>
          <textarea disabled rows={20} defaultValue={privacyContent} className={textareaClass} />
        </div>
        <p className="text-xs text-muted-foreground">
          Supported formatting: "## Heading", "### Subheading", "- list item", and "**bold**". Everything else
          renders as plain text.
        </p>
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
