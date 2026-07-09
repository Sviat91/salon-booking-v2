"use client"
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

// Only the fields we actually use from tenant config
type SalonContactInfo = {
  salonAddress?: string | null
  salonCity?: string | null
  salonPhone?: string | null
}

interface BookingSuccessProps {
  procedureName: string | null
  terminLabel: string
  procedurePrice?: number
  isAuth: boolean
  onClose: () => void
}

export default function BookingSuccess({
  procedureName,
  terminLabel,
  procedurePrice,
  isAuth,
  onClose,
}: BookingSuccessProps) {
  const { t } = useTranslation()

  // Fetch salon contact info from tenant config
  const { data: tenantConfig } = useQuery<SalonContactInfo>({
    queryKey: ['tenant-config-contact'],
    queryFn: () => fetch('/api/tenant-config').then(r => r.json() as Promise<SalonContactInfo>),
    staleTime: 60 * 60 * 1000, // 1 hour — config rarely changes
  })

  const hasAddress = tenantConfig?.salonAddress || tenantConfig?.salonCity || tenantConfig?.salonPhone

  return (
    <div className="transition-all duration-300 ease-out">
      <div className="text-lg font-medium mb-3 text-foreground">{t('success.title')}</div>
      
      <div className="space-y-1 mb-4">
        <div className="text-sm text-muted-foreground">
          <strong>{t('success.serviceLabel')}</strong> {procedureName ?? t('common.noData')}
        </div>
        <div className="text-sm text-muted-foreground">
          <strong>{t('success.dateLabel')}</strong> {terminLabel}
        </div>
        {procedurePrice && (
          <div className="text-sm text-muted-foreground">
            <strong>{t('success.priceLabel')}</strong> {procedurePrice} zł
          </div>
        )}
      </div>
      
      {hasAddress && (
        <div className="mb-4 rounded-lg border border-border/70 bg-card/60 p-3">
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">{t('success.addressLabel')}</strong><br />
            {tenantConfig.salonAddress && <>{tenantConfig.salonAddress}<br /></>}
            {tenantConfig.salonCity && <>{tenantConfig.salonCity}<br /></>}
            {tenantConfig.salonPhone && <>{tenantConfig.salonPhone}</>}
          </div>
        </div>
      )}
      
      <div className="text-emerald-700 dark:text-emerald-400 mb-4">{t('success.thankYou')}</div>

      {!isAuth && (
        <div className="mb-5 rounded-xl border border-primary/25 bg-primary/5 dark:bg-primary/10 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-primary text-lg leading-none select-none" aria-hidden="true">✨</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground mb-0.5">
                {t('success.guestBannerTitle')}
              </p>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                {t('success.guestBannerDesc')}
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href="/auth/register"
                  className="btn btn-primary py-2 px-4 text-xs flex-1 text-center"
                >
                  {t('success.guestBannerRegister')}
                </a>
                <a
                  href="/auth/login?callbackUrl=/profile"
                  className="btn btn-outline py-2 px-4 text-xs flex-1 text-center"
                >
                  {t('success.guestBannerLogin')}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <button
        type="button"
        onClick={onClose}
        className="btn btn-outline w-full"
      >
        {t('success.close')}
      </button>
    </div>
  )
}
