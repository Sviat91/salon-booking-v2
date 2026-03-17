"use client"
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import MasterSelector from '@/components/MasterSelector'
import ReviewsMarquee from '@/components/reviews/ReviewsMarquee'
import ThemeToggle from '@/components/ThemeToggle'
import LanguageToggle from '@/components/LanguageToggle'
import Image from 'next/image'
import Link from 'next/link'
import { MASTER_IDS } from '@/config/masters'
import { ReviewImage } from '@/lib/reviews'

interface HomeClientProps {
  initialReviews: ReviewImage[]
}

export default function HomeClient({ initialReviews }: HomeClientProps) {
  const queryClient = useQueryClient()

  // Prefetching for procedures will be implemented dynamically later through Prisma

  return (
    <main className="flex flex-col relative pb-4">
      {/* Theme, Language and Login toggles */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <Link 
          href="/admin" 
          className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors duration-300"
          title="Login"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-foreground/80 hover:text-foreground"
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </Link>
        <LanguageToggle />
        <ThemeToggle />
      </div>
      
      {/* Desktop Logo - top left */}
      <div className="absolute left-4 top-4 z-10 hidden lg:block">
        {/* Light theme */}
        <Image
          src="/head_logo.png"
          alt="Logo Somique Beauty"
          width={242}
          height={97}
          className="h-auto dark:hidden"
          priority
        />
        {/* Dark theme */}
        <Image
          src="/head_logo_night.png"
          alt="Logo Somique Beauty"
          width={242}
          height={97}
          className="h-auto hidden dark:block"
          priority
        />
      </div>

      {/* Mobile Logo - centered */}
      <div className="block lg:hidden pt-6 pb-2 px-4 text-center">
        {/* Light theme */}
        <Image
          src="/head_logo.png"
          alt="Logo Somique Beauty"
          width={200}
          height={80}
          className="h-auto max-w-[160px] sm:max-w-[180px] mx-auto dark:hidden"
          priority
        />
        {/* Dark theme */}
        <Image
          src="/head_logo_night.png"
          alt="Logo Somique Beauty"
          width={200}
          height={80}
          className="h-auto max-w-[160px] sm:max-w-[180px] mx-auto hidden dark:block"
          priority
        />
      </div>

      {/* Master Selector */}
      <div className="flex justify-center px-4 pt-8 lg:pt-24">
        <MasterSelector />
      </div>

      {/* Reviews Marquee - Desktop Only */}
      <div className="hidden lg:block mt-auto pt-12 w-full">
        <ReviewsMarquee initialReviews={initialReviews} />
      </div>
    </main>
  )
}
