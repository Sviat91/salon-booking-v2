import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Globe, User } from 'lucide-react'

interface MasterSelectDropdownProps {
  selectedMasterId: string
  masters: { id: string; name: string; color: string }[]
  onChange: (id: string) => void
}

// Simplified port of the real MasterSelectDropdown.tsx: trigger button +
// panel, "All Masters" vs a specific master. The real component portals the
// panel to document.body with fixed-position viewport-clamping math (needed
// there because it's nested deep in a scrollable admin shell); this demo's
// toolbar has no such clipping ancestor, so a plain absolutely-positioned
// panel under the trigger is enough — same look, no positioning math needed.
export default function MasterSelectDropdown({ selectedMasterId, masters, onChange }: MasterSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const selected = masters.find((m) => m.id === selectedMasterId)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-transparent hover:bg-muted rounded-md transition-colors border border-border"
      >
        {selectedMasterId === 'all' ? (
          <span className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            <span className="inline-block min-w-[22ch] text-center">All Masters</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            {selected?.name ?? 'Select master'}
          </span>
        )}
        <ChevronRight className={`h-3.5 w-3.5 opacity-50 transition-transform ${open ? 'rotate-[270deg]' : 'rotate-90'}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="max-h-[300px] overflow-y-auto">
            <button
              className={`w-full text-left px-4 py-3 text-sm hover:bg-primary hover:text-primary-foreground transition-colors ${selectedMasterId === 'all' ? 'bg-primary/20 text-primary font-medium' : ''}`}
              onClick={() => { onChange('all'); setOpen(false) }}
            >
              <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />All Masters (Combined)</span>
            </button>
            <div className="h-px w-full bg-border/60" />
            {masters.map((m) => (
              <button
                key={m.id}
                className={`w-full text-left px-4 py-3 text-sm border-b border-border/40 last:border-0 hover:bg-primary hover:text-primary-foreground transition-colors ${selectedMasterId === m.id ? 'bg-primary/20 text-primary font-medium' : ''}`}
                onClick={() => { onChange(m.id); setOpen(false) }}
              >
                <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{m.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
