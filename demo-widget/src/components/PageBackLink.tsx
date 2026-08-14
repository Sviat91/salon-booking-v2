import { t } from '../lib/i18n'
import { cn } from '../lib/utils'

interface PageBackLinkProps {
  onClick: () => void
  className?: string
  iconOnly?: boolean
}

export default function PageBackLink({ onClick, className, iconOnly }: PageBackLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={iconOnly ? t('common.back') : undefined}
      className={cn(
        'inline-flex items-center gap-2 bg-card border border-border text-card-foreground hover:brightness-105 transition-all duration-200 shadow-lg text-sm font-medium shrink-0',
        iconOnly ? 'justify-center rounded-full p-2' : 'rounded-2xl px-4 py-2',
        className
      )}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {!iconOnly && t('common.back')}
    </button>
  )
}
