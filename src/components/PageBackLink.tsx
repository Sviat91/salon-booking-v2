"use client"
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface PageBackLinkProps {
  href?: string
  className?: string
  /** Circular icon-only button (no "Back" label) — used next to a corner logo, where the fixed pill width made overlap possible regardless of position. */
  iconOnly?: boolean
}

export default function PageBackLink({ href = '/', className, iconOnly }: PageBackLinkProps) {
  const { t } = useTranslation()

  return (
    <Link
      href={href}
      aria-label={iconOnly ? t('common.back') : undefined}
      className={cn(
        "inline-flex items-center gap-2 bg-card border border-border text-card-foreground hover:brightness-105 transition-all duration-200 shadow-lg text-sm font-medium shrink-0",
        iconOnly ? "justify-center rounded-full p-2" : "rounded-2xl px-4 py-2",
        className
      )}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {!iconOnly && t('common.back')}
    </Link>
  )
}
