import { useState } from 'react'
import { Card } from '../ui/card'
import SearchPanel, { type SearchFormData } from './SearchPanel'
import NoResultsPanel from './NoResultsPanel'
import ResultsPanel from './ResultsPanel'
import { findBookings, type StoredBooking } from '../../lib/localBookings'
import { t } from '../../lib/i18n'

type PanelState = 'search' | 'searching' | 'no-results' | 'results'

// Ported from the real BookingManagement.tsx: the "Manage booking" card,
// its closed/open toggle, and the panel transition classes are identical.
// The real widget backs a full lookup/cancel/reschedule state machine
// (~20 panel components) against real booking records. This demo searches
// real localStorage bookings created via BookingForm (see that file) — a
// genuine search over genuine local data — but doesn't carry the
// change/cancel actions further, since those need a mutable backend.
export default function BookingManagement() {
  const [isOpen, setIsOpen] = useState(false)
  const [panel, setPanel] = useState<PanelState>('search')
  const [form, setForm] = useState<SearchFormData>({ fullName: '', phone: '' })
  const [results, setResults] = useState<StoredBooking[]>([])

  const canSearch = form.fullName.trim().length >= 2 && form.phone.replace(/\D/g, '').length >= 9

  function handleSearch() {
    setPanel('searching')
    setTimeout(() => {
      const found = findBookings(form.fullName, form.phone)
      setResults(found)
      setPanel(found.length > 0 ? 'results' : 'no-results')
    }, 500)
  }

  return (
    <Card title={t('booking.manageBooking')} className="!px-2 !py-3 sm:!px-4 sm:!py-4">
      <div className="space-y-3 mt-2">
        {!isOpen ? (
          <button type="button" onClick={() => setIsOpen(true)} className="btn btn-primary w-full">
            {t('booking.clickToManage')}
          </button>
        ) : (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setPanel('search')
              }}
              className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
            >
              {t('booking.closePanel')}
            </button>
          </div>
        )}
        <div className={`transition-all duration-200 ease-out w-full max-w-full ${isOpen ? 'opacity-100 mt-2' : 'max-h-0 opacity-0 overflow-hidden'}`}>
          <div
            className={`rounded-xl border border-border bg-card text-card-foreground p-4 w-full max-w-full box-border overflow-x-hidden ${isOpen ? 'max-h-[35rem] overflow-y-auto' : ''}`}
          >
            {panel === 'results' ? (
              <ResultsPanel
                results={results}
                fullName={form.fullName}
                phone={form.phone}
                onBackToSearch={() => setPanel('search')}
                onNewSearch={() => {
                  setForm({ fullName: '', phone: '' })
                  setPanel('search')
                }}
              />
            ) : panel === 'no-results' ? (
              <NoResultsPanel onRetry={() => setPanel('search')} />
            ) : (
              <SearchPanel
                form={form}
                onFormChange={(next) => setForm((f) => ({ ...f, ...next }))}
                canSearch={canSearch}
                isLoading={panel === 'searching'}
                onSearch={handleSearch}
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
