"use client"
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface BackButtonProps {
  href?: string
}

export default function BackButton({ href = '/' }: BackButtonProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
      className="fixed top-6 left-6 z-50"
    >
      <Link
        href={href}
        className="inline-flex items-center gap-2 px-4 py-2 bg-card rounded-2xl border border-border text-card-foreground hover:brightness-105 transition-all duration-200 shadow-lg text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('common.back')}
      </Link>
    </motion.div>
  )
}
