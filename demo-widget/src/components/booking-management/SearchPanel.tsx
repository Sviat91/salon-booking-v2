import { t } from '../../lib/i18n'

export interface SearchFormData {
  fullName: string
  phone: string
}

interface SearchPanelProps {
  form: SearchFormData
  onFormChange: (next: Partial<SearchFormData>) => void
  canSearch: boolean
  isLoading: boolean
  onSearch: () => void
}

// Ported from the real SearchPanel.tsx. The real component also renders
// PhoneInput (country-code dropdown) and an email field, plus a Turnstile
// slot — this demo's phone field is a plain input for the same reason
// BookingForm skips Turnstile: no real backend to validate against.
export default function SearchPanel({ form, onFormChange, canSearch, isLoading, onSearch }: SearchPanelProps) {
  return (
    <div className="overflow-y-auto space-y-4 pr-1">
      <div className="text-sm text-muted-foreground">{t('management.enterDataToFind')}</div>

      <div className="space-y-3">
        <input
          className="w-full max-w-full box-border rounded-xl border border-border bg-transparent text-foreground px-3 py-2 placeholder:text-muted-foreground"
          placeholder={t('form.name')}
          value={form.fullName}
          onChange={(event) => onFormChange({ fullName: event.target.value })}
        />
        <input
          className="w-full max-w-full box-border rounded-xl border border-border bg-transparent text-foreground px-3 py-2 placeholder:text-muted-foreground"
          placeholder={t('form.phone')}
          value={form.phone}
          onChange={(event) => onFormChange({ phone: event.target.value })}
        />
      </div>

      <button
        type="button"
        disabled={!canSearch || isLoading}
        onClick={onSearch}
        className={`btn btn-primary w-full ${!canSearch || isLoading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {isLoading ? t('management.searching') : t('management.searchBookings')}
      </button>
    </div>
  )
}
