"use client"
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

export default function BackButton() {
  const { t } = useTranslation()
  
  return (
    <div className="fixed top-6 left-6 z-50">
      <Link 
        href="/" 
        className="inline-flex items-center gap-2 px-4 py-2 bg-card rounded-2xl border border-border text-card-foreground hover:brightness-105 transition-all duration-200 shadow-lg text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('common.back')}
      </Link>
    </div>
  )
}
