import type { ReactNode } from 'react'
import { useBrand } from '../../context/BrandContext'
import { DEFAULT_BRAND } from '../../lib/brandSettings'

// Ported from the real SettingsForm.tsx structure: NOT tabs — a single
// scrollable stack of section cards, same order as the real page (Brand,
// Salon Contact Info, Calendar Settings, Business Hours, Content Languages,
// Homepage widget, Light Theme, Dark Theme Colors). Every field the real
// page has is shown with its real label; only Salon Name and the two accent
// colors ("Primary Button" / "Dark Primary Button" — the real field names)
// are actually editable, matching what was asked. `SuperAdminCredentials`
// (rendered below the form, SUPERADMIN-only in the real page) is the one
// section left out entirely — a credentials-change form isn't meaningful to
// fake in a marketing demo.
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

function EditableColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-9 cursor-pointer rounded-md border border-border bg-transparent" />
        <span className="text-sm text-muted-foreground">{value}</span>
      </div>
    </label>
  )
}

function ResetToM3({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 text-xs font-medium text-primary hover:underline">
      Reset to M3
    </button>
  )
}

export default function SettingsPage() {
  const { brand, updateBrand } = useBrand()

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Settings</p>
          <p className="mt-1 text-sm text-muted-foreground">General salon information and branding.</p>
        </div>

        <Section title="Brand" description="Salon name and visual identity">
          <label className="flex flex-col gap-1.5 max-w-sm">
            <span className="text-sm font-medium text-foreground">Salon Name</span>
            <input
              value={brand.name}
              onChange={(e) => updateBrand({ name: e.target.value })}
              className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground">Shown in the browser tab title and meta tags.</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">Logo (light/dark)</div>
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">Favicon</div>
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">Theme-toggle icons</div>
          </div>
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

        <Section title="Content Languages">
          <p className="text-sm text-muted-foreground">English — the only language enabled in this demo.</p>
        </Section>

        <Section title="Homepage widget">
          <p className="text-sm text-muted-foreground">Photo strip (marquee) — shown at the bottom of the homepage.</p>
        </Section>

        <Section title="Light Theme" action={<ResetToM3 onClick={() => updateBrand({ lightAccent: DEFAULT_BRAND.lightAccent })} />}>
          <div className="grid gap-4 sm:grid-cols-3">
            <ColorField label="Secondary Tint" value="#eaecee" />
            <ColorField label="Card Background" value="#ffffff" />
            <EditableColorField label="Primary Button" value={brand.lightAccent} onChange={(v) => updateBrand({ lightAccent: v })} />
            <ColorField label="Body Text" value="#1a1d20" />
            <ColorField label="Muted Text" value="#6c757d" />
            <ColorField label="Borders" value="#e2e8f0" />
          </div>
        </Section>

        <Section title="Dark Theme Colors" action={<ResetToM3 onClick={() => updateBrand({ darkAccent: DEFAULT_BRAND.darkAccent })} />}>
          <div className="grid gap-4 sm:grid-cols-3">
            <ColorField label="Dark Background" value="#121417" />
            <ColorField label="Dark Secondary Tint" value="#22262b" />
            <ColorField label="Dark Card" value="#1a1d22" />
            <EditableColorField label="Dark Primary Button" value={brand.darkAccent} onChange={(v) => updateBrand({ darkAccent: v })} />
            <ColorField label="Dark Text" value="#f1f3f5" />
            <ColorField label="Dark Muted Text" value="#8b95a1" />
            <ColorField label="Dark Borders" value="#2d3239" />
          </div>
        </Section>
      </div>

      <div className="lg:sticky lg:top-4 h-fit">
        <div className="rounded-[20px] border border-border bg-card shadow-sm p-4">
          <div className="mb-3 text-sm font-medium text-muted-foreground">Live preview</div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">{brand.name}</span>
              <div className="h-6 w-6 rounded-full bg-muted" />
            </div>
            <div className="mb-3 h-16 w-16 rounded-full bg-muted mx-auto" />
            <button className="btn-primary w-full rounded-full px-4 py-2 text-sm font-medium">Click to manage your booking</button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Reflects the two editable fields only — the real preview is the actual site (Back to site).</p>
        </div>
      </div>
    </div>
  )
}
