type Tone = 'primary' | 'secondary' | 'tertiary' | 'surface-high'

// Ported exactly from the real StatCard.tsx — MD3 container-token classes,
// not approximated. Tokens themselves are in index.css (:root / .dark).
const TONE_CLASSES: Record<Tone, string> = {
  primary: 'bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]',
  secondary: 'bg-[var(--md-secondary-container)] text-[var(--md-on-secondary-container)]',
  tertiary: 'bg-[var(--md-tertiary-container)] text-[var(--md-on-tertiary-container)]',
  'surface-high': 'bg-[var(--md-surface-container-high)] text-[var(--md-on-surface)]',
}

export default function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: Tone }) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl px-6 py-5 ${TONE_CLASSES[tone]}`}>
      <div className="text-[13px] font-normal opacity-80">{label}</div>
      <div className="mt-1 text-[36px] font-normal leading-none tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-70">{sub}</div>}
    </div>
  )
}
