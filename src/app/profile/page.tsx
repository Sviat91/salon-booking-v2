"use client"

import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import ThemeToggle from "@/components/ThemeToggle"
import LanguageToggle from "@/components/LanguageToggle"
import BackButton from "@/components/BackButton"
import { signOut } from "next-auth/react"
import Link from "next/link"
import LinkBookingsCard from "@/components/profile/LinkBookingsCard"
import EditAppointmentModal, { type EditableAppointment } from "@/components/profile/EditAppointmentModal"

type AppointmentData = EditableAppointment & {
  status: string
  notes: string | null
}

type ProfileData = {
  user: { name: string; email: string; phone: string | null; createdAt: string }
  upcoming: AppointmentData[]
  past: AppointmentData[]
  stats: { totalVisits: number }
}

function toDatePart(dateIso: string) {
  return new Date(dateIso).toISOString().slice(0, 10)
}

function canModifyLocally(appointment: AppointmentData) {
  if (appointment.status === "CANCELLED") return false
  const datePart = toDatePart(appointment.date)
  const dt = new Date(`${datePart}T${appointment.startTime}:00`)
  const hoursUntil = (dt.getTime() - Date.now()) / (1000 * 60 * 60)
  return hoursUntil >= 24
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [showPast, setShowPast] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<AppointmentData | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

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
    (masterId: string) => {
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
      case "CONFIRMED": return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
      case "PENDING": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
      case "CANCELLED": return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
      case "COMPLETED": return "bg-muted text-muted-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const handleCancelAppointment = async (appointmentId: string) => {
    setActionMessage(null)
    setActionLoadingId(appointmentId)

    try {
      const res = await fetch(`/api/client/appointments/${appointmentId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || t('common.error', 'Error'))
      }

      await refetch()
      setActionMessage({
        type: "success",
        text: t("management.cancelSuccess", "Booking cancelled"),
      })
    } catch (e: any) {
      setActionMessage({
        type: "error",
        text: e?.message || t('common.error', 'Error'),
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleEditSaved = async () => {
    await refetch()
    setActionMessage({
      type: "success",
      text: t("management.changeSuccess", "Changes saved"),
    })
  }

  const upcomingWithFlags = useMemo(() => {
    if (!data) return []
    return data.upcoming.map((a) => ({
      ...a,
      canModify: canModifyLocally(a),
    }))
  }, [data])

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

  const { user, past } = data

  return (
    <main className="px-3 py-4 sm:p-6 relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">
      <BackButton />
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-lg mt-8 space-y-6">
        <h1 className="text-2xl font-semibold text-foreground text-center">
          {t("profile.title", "My Appointments")}
        </h1>

        {actionMessage && (
          <div className={`rounded-lg border px-3 py-2 text-sm ${
            actionMessage.type === "success"
              ? "border-green-300 bg-green-50 text-green-700"
              : "border-red-300 bg-red-50 text-red-700"
          }`}>
            {actionMessage.text}
          </div>
        )}

        <Card className="!px-4 !py-4 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-lg font-medium text-foreground">
                {t("profile.hello", "Hello")}, {user.name}!
              </p>
              <div className="text-sm text-muted-foreground mt-1 space-y-1">
                <p>✉️ {user.email}</p>
                <p>📱 {user.phone || t('profile.noPhone', 'Phone not provided')}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-border">
            <Link href="/profile/edit" className="btn btn-outline text-sm flex-1 text-center py-2">
              {t('profile.editProfile', 'Edit Profile')}
            </Link>
            <button onClick={handleSignOut} className="btn btn-outline text-sm flex-1 text-center py-2 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20">
              {t('profile.signOut', 'Sign Out')}
            </button>
          </div>
        </Card>

        {upcomingWithFlags.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              {t("profile.upcoming", "Upcoming")}
            </h2>
            {upcomingWithFlags.map((a) => (
              <Card key={a.id} className="!px-4 !py-3 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">
                      {a.service.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(a.date)} - {a.startTime}-{a.endTime}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t("profile.master", "Specialist")}: {a.master.name}
                    </div>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(a.status)}`}>
                      {statusLabel(a.status)}
                    </span>
                  </div>
                  {a.service.price > 0 && (
                    <div className="text-sm font-medium text-foreground whitespace-nowrap ml-3">
                      {a.service.price} zł
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingAppointment(a)}
                    disabled={!a.canModify}
                    className="btn btn-outline text-xs px-3 py-1.5 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {t("management.editBooking", "Edit booking")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancelAppointment(a.id)}
                    disabled={!a.canModify || actionLoadingId === a.id}
                    className="btn btn-outline text-xs px-3 py-1.5 text-red-500 border-red-200 hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {actionLoadingId === a.id
                      ? t('common.loading', 'Loading...')
                      : t("management.cancelBooking", "Cancel booking")}
                  </button>
                </div>

                {!a.canModify && (
                  <p className="text-xs text-muted-foreground">
                    {t('management.lessThan24h', 'Less than 24h - contact the specialist')}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <Card className="!px-4 !py-4">
            <button
              onClick={() => setShowPast(!showPast)}
              className="flex items-center justify-between w-full py-2 group text-left"
            >
              <h2 className="text-lg font-semibold text-foreground group-hover:opacity-80 transition-opacity">
                {t("profile.past", "Past")}
              </h2>
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
                className={`text-muted-foreground transition-transform duration-200 ${showPast ? "rotate-180" : ""}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {showPast && (
              <div className="mt-3 space-y-2 animate-fade-in-up">
                {past.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{a.service.name}</div>
                      <div className="text-sm text-muted-foreground">{formatDate(a.date)}</div>
                    </div>
                    <button
                      onClick={() => handleRepeat(a.master.id)}
                      className="btn btn-outline text-xs !px-3 !py-1.5 whitespace-nowrap shrink-0"
                    >
                      {t("profile.repeat", "Book again")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {upcomingWithFlags.length === 0 && past.length === 0 && (
          <Card className="!px-4 !py-6 text-center">
            <p className="text-muted-foreground mb-4">
              {t("profile.noAppointmentsAuth", "You don't have any appointments yet.")}
            </p>
            <Link href="/" className="btn btn-primary inline-block">
              {t("profile.bookNow", "Book Now")}
            </Link>
          </Card>
        )}

        <LinkBookingsCard />
      </div>

      <EditAppointmentModal
        open={Boolean(editingAppointment)}
        appointment={editingAppointment}
        onClose={() => setEditingAppointment(null)}
        onSaved={handleEditSaved}
      />
    </main>
  )
}
