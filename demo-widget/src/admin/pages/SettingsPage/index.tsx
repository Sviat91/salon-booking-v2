import type { ReactNode } from 'react'
import { useBrand } from '../../../context/BrandContext'
import { M3_LIGHT_DEFAULTS, M3_DARK_DEFAULTS, type BrandSettings } from '../../../lib/brandSettings'
import BrandSection from './BrandSection'
import BackgroundField from './BackgroundField'
import LanguagesSection from './LanguagesSection'
import HomepageWidgetSection from './HomepageWidgetSection'
import SecuritySection from './SecuritySection'

// Ported from the real SettingsForm.tsx structure: NOT tabs, NOT a sidebar —
// a single full-width, single-column scrollable stack of section cards, same
// order as the real page.tsx/SettingsForm.tsx (Brand, Salon Contact Info,
// Calendar Settings, Business Hours, Content Languages, Homepage widget,
// Light Theme, Dark Theme Colors, then Security below an <hr>). Every field
// the real page has is shown with its real label. Salon Name and all 13
// Light/Dark Theme color fields are genuinely editable via BrandContext's
// draft/save flow (Save button lives in the sidebar, see AdminSidebar.tsx).
// Everything else (Brand's logo/favicon/theme-toggle-icon controls, the
// Background fields, Calendar Settings colors, Content Languages, Homepage
// widget, and Security) is visually present but fully inert — see
// BrandSection.tsx, BackgroundField.tsx, LanguagesSection.tsx,
// HomepageWidgetSection.tsx and SecuritySection.tsx.
function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-[20px] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-6 p-6">{children}</div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <input
        value={value}
        disabled
        className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-muted-foreground cursor-not-allowed"
      />
    </label>
  )
}

function ColorField({ label, value }: { label: string; value: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 shrink-0 rounded-md border border-border" style={{ backgroundColor: value }} />
        <span className="text-sm text-muted-foreground">{value}</span>
      </div>
    </label>
  )
}

function DraftColorRow({ field, label, description }: { field: keyof BrandSettings; label: string; description: string }) {
  const { draft, updateDraft } = useBrand()
  const value = draft[field]
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => updateDraft({ [field]: e.target.value } as Partial<BrandSettings>)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
        />
        <input
          value={value}
          onChange={(e) => updateDraft({ [field]: e.target.value } as Partial<BrandSettings>)}
          pattern="^#[0-9A-Fa-f]{6}$"
          className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </label>
  )
}

function ResetToM3({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
    >
      Reset to M3 defaults
    </button>
  )
}

export default function SettingsPage() {
  const { draft, updateDraft } = useBrand()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Settings</p>
        <p className="mt-1 text-sm text-muted-foreground">Brand, colours, contact details and business hours</p>
      </div>

      <Section title="Brand" description="Salon name and visual identity">
        <label className="flex flex-col gap-1.5 max-w-sm">
          <span className="text-sm font-medium text-foreground">Salon Name</span>
          <input
            value={draft.name}
            onChange={(e) => updateDraft({ name: e.target.value })}
            className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground">Shown in the browser tab title and meta tags.</span>
        </label>
        <BrandSection />
      </Section>

      <Section title="Salon Contact Info">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company Name" value="Loom & Blade Sp. z o.o." />
          <Field label="Tax ID (NIP)" value="000-000-00-00" />
          <Field label="Address" value="ul. Grzybowska 62/lok. U4" />
          <Field label="City" value="Warszawa" />
          <Field label="Legal Address" value="ul. Grzybowska 62/lok. U4, 00-844 Warszawa" />
          <Field label="Phone" value="+48 000 000 000" />
          <Field label="Email" value="hello@loomandblade.pl" />
        </div>
      </Section>

      <Section title="Calendar Settings">
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label="Available Slot color" value="#21A67A" />
          <ColorField label="Day Off color" value="#BA1A1A" />
        </div>
      </Section>

      <Section title="Business Hours">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Open Hour" value="8" />
          <Field label="Close Hour" value="21" />
        </div>
      </Section>

      <LanguagesSection />
      <HomepageWidgetSection />

      <Section title="Light Theme" action={<ResetToM3 onClick={() => updateDraft(M3_LIGHT_DEFAULTS)} />}>
        <BackgroundField />
        <div className="grid gap-4 sm:grid-cols-3">
          <DraftColorRow field="primaryColor" label="Secondary Tint" description="Accent backgrounds, hover states" />
          <DraftColorRow field="cardColor" label="Card Background" description="Background for cards and panels" />
          <DraftColorRow field="accentColor" label="Primary Button" description="Buttons and highlighted elements" />
          <DraftColorRow field="textColor" label="Body Text" description="Main text color" />
          <DraftColorRow field="mutedColor" label="Muted Text" description="Subtitles, placeholders" />
          <DraftColorRow field="borderColor" label="Borders" description="Color of dividers and outlines" />
        </div>
      </Section>

      <Section title="Dark Theme Colors" action={<ResetToM3 onClick={() => updateDraft(M3_DARK_DEFAULTS)} />}>
        <BackgroundField dark />
        <div className="grid gap-4 sm:grid-cols-3">
          <DraftColorRow field="darkBgColor" label="Dark Background" description="Main background in dark theme" />
          <DraftColorRow field="darkPrimaryColor" label="Dark Secondary Tint" description="Accent backgrounds, hover states" />
          <DraftColorRow field="darkCardColor" label="Dark Card" description="Card / panel background" />
          <DraftColorRow field="darkAccentColor" label="Dark Primary Button" description="Buttons and highlighted elements" />
          <DraftColorRow field="darkTextColor" label="Dark Text" description="Main text on dark background" />
          <DraftColorRow field="darkMutedColor" label="Dark Muted Text" description="Subtitles on dark background" />
          <DraftColorRow field="darkBorderColor" label="Dark Borders" description="Dividers in dark theme" />
        </div>
      </Section>

      <hr className="border-border" />
      <SecuritySection />
    </div>
  )
}
