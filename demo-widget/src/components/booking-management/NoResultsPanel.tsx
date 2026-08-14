import { t } from '../../lib/i18n'

export default function NoResultsPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="overflow-y-auto space-y-4 pr-1">
      <div className="text-center py-6">
        <div className="text-2xl mb-2">😔</div>
        <div className="text-lg font-medium text-foreground mb-2">{t('management.noBookingsFound')}</div>
        <div className="text-sm text-muted-foreground">
          {t('management.checkDataAndRetry')}
          <br />
          {t('management.useSameDataAsBooking')}
        </div>
      </div>
      <div className="space-y-3">
        <button type="button" onClick={onRetry} className="btn btn-primary w-full">
          {t('management.checkAgain')}
        </button>
      </div>
    </div>
  )
}
