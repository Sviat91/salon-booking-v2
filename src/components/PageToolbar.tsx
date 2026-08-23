"use client"
import PageBackLink from '@/components/PageBackLink'
import LanguageToggle from '@/components/LanguageToggle'
import ThemeToggle from '@/components/ThemeToggle'

interface PageToolbarProps {
  backHref?: string
}

export default function PageToolbar({ backHref = '/' }: PageToolbarProps) {
  return (
    <div className="pt-2 pl-3 pr-2 lg:pl-28 xl:pl-32 flex items-center justify-between gap-2">
      <PageBackLink href={backHref} iconOnly />
      <div className="flex items-center gap-2 shrink-0">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </div>
  )
}
