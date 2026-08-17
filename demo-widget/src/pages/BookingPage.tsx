import { useState } from 'react'
import { motion } from 'framer-motion'
import TopNavLine from '../components/TopNavLine'
import ThemeToggle from '../components/ThemeToggle'
import LanguageToggle from '../components/LanguageToggle'
import BrandHeader from '../components/BrandHeader'
import { Card } from '../components/ui/card'
import ProcedureSelect from '../components/ProcedureSelect'
import DayCalendar from '../components/DayCalendar'
import SlotsList, { type Slot } from '../components/SlotsList'
import BookingForm from '../components/BookingForm'
import BookingSuccessPanel from '../components/BookingSuccessPanel'
import BookingManagement from '../components/booking-management/BookingManagement'
import TodayPromoCard from '../components/TodayPromoCard'
import MasterFooterBlock from '../components/MasterFooterBlock'
import LogoDisplay from '../components/LogoDisplay'
import { useAppNavigation, useSelectedMaster, useAboutTab } from '../context/AppContext'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { t } from '../lib/i18n'
import type { Procedure } from '../types'

// Ported from the real [masterId]/page.tsx. The autoscroll-into-view
// machinery (calendar/slots/booking refs scrolling on mobile as each step is
// picked) is the one real piece of interaction dropped — it's scroll
// choreography, not visual styling, and orthogonal to what was being
// compared against the screenshots. Guest-conversion banner and the
// consent-modal step inside BookingForm are dropped for the same reason
// BookingForm.tsx itself is simplified (see that file's comment).
export default function BookingPage() {
  const { navigateHome } = useAppNavigation()
  const master = useSelectedMaster()
  const prefersReducedMotion = useReducedMotion()
  const tabs = useAboutTab()

  const [procedure, setProcedure] = useState<Procedure | null>(null)
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [pricing, setPricing] = useState<{ percent: number; price: number } | null>(null)

  if (!master) return null

  function resetToInitialState() {
    setProcedure(null)
    setDate(undefined)
    setSelectedSlot(null)
  }

  function handleBookingSuccess(finalPricing: { percent: number; price: number }) {
    setPricing(finalPricing)
    setShowSuccess(true)
  }

  const bookingCard =
    selectedSlot && !showSuccess ? (
      <Card title={t('booking.reservation')} className="!px-2 !py-3 sm:!px-4 sm:!py-4">
        <BookingForm slot={selectedSlot} procedure={procedure} onSuccess={handleBookingSuccess} />
      </Card>
    ) : null

  const successCard =
    showSuccess && selectedSlot ? (
      <Card title={t('booking.reservation')} className="!px-2 !py-3 sm:!px-4 sm:!py-4">
        <BookingSuccessPanel
          slot={selectedSlot}
          procedure={procedure}
          pricing={pricing}
          onClose={() => {
            setShowSuccess(false)
            setPricing(null)
            resetToInitialState()
          }}
        />
      </Card>
    ) : null

  return (
    <main className="px-3 py-4 sm:p-6 relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">
      <div className="absolute top-2 left-0 right-0 z-20 pl-3 lg:pl-28 xl:pl-32">
        <TopNavLine
          onBack={navigateHome}
          leadingSpaceClassName="pl-48"
          actions={
            <>
              <LanguageToggle />
              <ThemeToggle />
            </>
          }
          tabs={tabs}
        />
      </div>

      <LogoDisplay />

      <div className="mx-auto w-full max-w-5xl px-0 pt-12">
        <BrandHeader onLogoClick={navigateHome} />
        <motion.div
          className="mt-4 space-y-6 lg:grid lg:grid-cols-[auto,auto] lg:items-start lg:justify-center lg:gap-6 lg:space-y-0"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="lg:order-2">
            <div className="space-y-4 w-full max-w-sm mx-auto">
              <Card title={t('booking.service')} className="!px-2 !py-3 sm:!px-4 sm:!py-4">
                <ProcedureSelect
                  valueId={procedure?.id}
                  onChange={(p) => {
                    setProcedure(p)
                    setDate(undefined)
                    setSelectedSlot(null)
                  }}
                />
              </Card>

              <BookingManagement />
              <TodayPromoCard />

              <div className="hidden lg:block">
                {bookingCard}
                {successCard}
              </div>
            </div>
          </div>

          <div className="lg:order-1 space-y-6 w-full max-w-sm mx-auto lg:mx-0">
            <Card className="!px-2 !py-3 sm:!px-4 sm:!py-4">
              <DayCalendar
                key={`calendar-${procedure?.id ?? 'none'}`}
                procedureId={procedure?.id}
                onChange={(d) => {
                  setDate(d)
                  setSelectedSlot(null)
                }}
              />
              <SlotsList
                key={`slots-${procedure?.id ?? 'none'}-${date?.toISOString() ?? 'no-date'}`}
                date={date}
                durationMin={procedure?.durationMin ?? 45}
                selected={selectedSlot}
                onPick={setSelectedSlot}
              />
            </Card>

            <div className="lg:hidden transform transition-all duration-500 ease-in-out animate-fade-in-up">
              {bookingCard}
              {successCard}
            </div>
          </div>
        </motion.div>

        <MasterFooterBlock />
      </div>
    </main>
  )
}
