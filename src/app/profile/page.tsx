"use client"

import { useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import ThemeToggle from "@/components/ThemeToggle"
import LanguageToggle from "@/components/LanguageToggle"
import BackButton from "@/components/BackButton"
import { signOut } from "next-auth/react"
import Link from "next/link"

type AppointmentData = {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  notes: string | null
  service: { id: string; name: string; duration: number; price: number }
  master: { id: string; name: string }
}

type ProfileData = {
  user: { name: string; email: string; phone: string | null; createdAt: string }
  upcoming: AppointmentData[]
  past: AppointmentData[]
  stats: { totalVisits: number }
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const router = useRouter()

  const { data, isLoading, error, refetch } = useQuery<ProfileData>({
    queryKey: ['clientProfile'],
    queryFn: async () => {
      const res = await fetch('/api/client/profile')
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/auth/login')
        }
        throw new Error('Failed to fetch profile data')
      }
      return res.json()
    },
  })

  const handleRepeat = useCallback(
    (masterId: string, serviceId?: string) => {
      router.push(`/${masterId}`)
    },
    [router]
  )

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" })
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case "CONFIRMED": return t("profile.statusConfirmed", "Confirmed")
      case "PENDING": return t("profile.statusPending", "Pending")
      case "CANCELLED": return t("profile.statusCancelled", "Cancelled")
      case "COMPLETED": return t("profile.statusCompleted", "Completed")
      default: return status
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED": return "text-green-600 dark:text-green-400"
      case "PENDING": return "text-yellow-600 dark:text-yellow-400"
      case "CANCELLED": return "text-red-500 dark:text-red-400 line-through"
      case "COMPLETED": return "text-muted dark:text-dark-muted"
      default: return "text-text dark:text-dark-text"
    }
  }

  if (isLoading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-500 mb-4">{t('profile.errorLoading', 'Failed to load profile.')}</p>
        <button onClick={() => refetch()} className="btn btn-primary">{t('common.retry', 'Retry')}</button>
      </main>
    )
  }

  const { user, upcoming, past } = data

  return (
    <main className="px-3 py-4 sm:p-6 relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">
      <BackButton />
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-lg mt-8 space-y-6">
        <h1 className="text-2xl font-bold text-text dark:text-dark-text text-center">
          {t("profile.title", "My Appointments")}
        </h1>

        {/* User Card */}
        <Card className="!px-4 !py-4 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-lg font-medium text-text dark:text-dark-text">
                {t("profile.hello", "Hello")}, {user.name}!
              </p>
              <div className="text-sm text-muted dark:text-dark-muted mt-1 space-y-1">
                <p>✉️ {user.email}</p>
                <p>📱 {user.phone || t('profile.noPhone', 'Phone not provided')}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-border dark:border-dark-border">
            <Link href="/profile/edit" className="btn btn-outline text-sm flex-1 text-center py-2">
              {t('profile.editProfile', 'Edit Profile')}
            </Link>
            <button onClick={handleSignOut} className="btn btn-outline text-sm flex-1 text-center py-2 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20">
              {t('profile.signOut', 'Sign Out')}
            </button>
          </div>
        </Card>

        {/* Upcoming appointments */}
        {upcoming.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-text dark:text-dark-text">
              {t("profile.upcoming", "Upcoming")}
            </h2>
            {upcoming.map((a) => (
              <Card key={a.id} className="!px-4 !py-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="font-medium text-text dark:text-dark-text">
                      {a.service.name}
                    </div>
                    <div className="text-sm text-muted dark:text-dark-muted">
                      {formatDate(a.date)} • {a.startTime}–{a.endTime}
                    </div>
                    <div className="text-sm text-muted dark:text-dark-muted">
                      {t("profile.master", "Specialist")}: {a.master.name}
                    </div>
                    <div className={`text-xs font-medium ${statusColor(a.status)}`}>
                      {statusLabel(a.status)}
                    </div>
                  </div>
                  {a.service.price > 0 && (
                    <div className="text-sm font-medium text-text dark:text-dark-text whitespace-nowrap ml-3">
                      {a.service.price} zł
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Past appointments */}
        {past.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-text dark:text-dark-text">
              {t("profile.past", "Past")}
            </h2>
            {past.map((a) => (
              <Card key={a.id} className="!px-4 !py-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="font-medium text-text dark:text-dark-text opacity-70">
                      {a.service.name}
                    </div>
                    <div className="text-sm text-muted dark:text-dark-muted">
                      {formatDate(a.date)} • {a.startTime}–{a.endTime}
                    </div>
                    <div className="text-sm text-muted dark:text-dark-muted">
                      {t("profile.master", "Specialist")}: {a.master.name}
                    </div>
                    <div className={`text-xs font-medium ${statusColor(a.status)}`}>
                      {statusLabel(a.status)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRepeat(a.master.id, a.service.id)}
                    className="btn btn-outline text-xs !px-3 !py-1.5 whitespace-nowrap ml-3 shrink-0"
                  >
                    {t("profile.repeat", "Book again")}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {upcoming.length === 0 && past.length === 0 && (
          <Card className="!px-4 !py-6 text-center">
            <p className="text-muted dark:text-dark-muted mb-4">
              {t("profile.noAppointmentsAuth", "You don't have any appointments yet.")}
            </p>
            <Link href="/" className="btn btn-primary inline-block">
              {t("profile.bookNow", "Book Now")}
            </Link>
          </Card>
        )}
      </div>
    </main>
  )
}
