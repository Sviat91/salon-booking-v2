import { useEffect, useState, type MouseEvent } from 'react'
import { useSelectedMaster } from '../context/AppContext'
import { t } from '../lib/i18n'
import type { Procedure } from '../types'

export default function ProcedureSelect({ valueId, onChange }: { valueId?: string; onChange?: (p: Procedure | null) => void }) {
  const master = useSelectedMaster()
  const items = master?.services ?? []

  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Procedure | null>(null)

  useEffect(() => {
    if (!valueId) {
      setSelected(null)
      return
    }
    setSelected(items.find((p) => p.id === valueId) ?? null)
  }, [valueId, items])

  const handleCardClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (open) {
        setOpen(false)
      } else if (selected) {
        setSelected(null)
        onChange?.(null)
      }
    }
  }

  const formatProcedure = (p: Procedure) => (
    <>
      {p.name} - {p.durationMin} {t('booking.minutes')} /{' '}
      <span className="line-through text-muted-foreground/70">{p.priceOld} zł</span>{' '}
      <span className="font-medium">{p.price} zł</span>
    </>
  )

  return (
    <div className="relative lg:-m-4 lg:p-4" onClick={handleCardClick}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-accent text-card-foreground shadow-sm"
      >
        {selected ? (
          <span className="block whitespace-normal break-words">{formatProcedure(selected)}</span>
        ) : (
          <span className="text-muted-foreground">{t('booking.selectService')}</span>
        )}
        <span className={`absolute right-3 top-1/2 -translate-y-1/2 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${open ? 'max-h-72 opacity-100 mt-2' : 'max-h-0 opacity-0'} bg-card text-card-foreground border border-border rounded-xl shadow-md z-10 relative`}
      >
        <ul className="max-h-72 overflow-auto p-1">
          {items.map((p) => (
            <li key={p.id}>
              <button
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted focus:bg-muted focus:outline-none whitespace-normal break-words transition-colors"
                onClick={() => {
                  setSelected(p)
                  setOpen(false)
                  onChange?.(p)
                }}
              >
                {formatProcedure(p)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
