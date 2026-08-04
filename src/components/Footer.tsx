"use client"
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DEFAULT_BRAND_NAME } from '@/lib/constants/brand'

type BrandConfig = {
  brandName: string
}

export default function Footer() {
  const { t } = useTranslation()
  const { data: config } = useQuery<BrandConfig>({
    queryKey: ['tenant-config'],
    queryFn: () => fetch('/api/tenant-config').then(r => r.json() as Promise<BrandConfig>),
    staleTime: 60 * 60 * 1000,
  })

  return (
    <footer className="py-3">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <div className="text-sm text-neutral-500 dark:text-dark-muted">
            <Link 
              href="/privacy" 
              className="hover:text-primary dark:hover:text-accent transition-colors"
            >
              {t('footer.privacy')}
            </Link>
            <span className="mx-2">•</span>
            <Link 
              href="/terms" 
              className="hover:text-primary dark:hover:text-accent transition-colors"
            >
              {t('footer.terms')}
            </Link>
            <span className="mx-2">•</span>
            <Link 
              href="/support" 
              className="hover:text-primary dark:hover:text-accent transition-colors"
            >
              {t('support.title')}
            </Link>
            <span className="mx-4">|</span>
            <span>{t('footer.copyright', { year: new Date().getFullYear(), brandName: config?.brandName || DEFAULT_BRAND_NAME })}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
