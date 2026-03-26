"use client"

import { useState, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import ThemeToggle from "@/components/ThemeToggle"
import LanguageToggle from "@/components/LanguageToggle"
import BackButton from "@/components/BackButton"
import PhoneInput from "@/components/ui/PhoneInput"

type AppointmentData = {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  notes: string | null
  service: { id: string; name: string; duration: number; price: number }
  master: { id: string; name: string; masterProfile: { avatarUrl: string | null } | null }
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const router = useRouter()

  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appointments, setAppointments] = useState<AppointmentData[] | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (phone.length < 5) {
      setError(t("profile.phoneMinLength", "Введите номер телефона (минимум 5 символов)"))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/client/appointments?phone=${encodeURIComponent(phone)}`)
      if (!res.ok) throw new Error("Failed to fetch")

      const data = await res.json()
      setAppointments(data.appointments || [])
      setClientName(data.clientName || null)
    } catch {
      setError(t("profile.fetchError", "Не удалось загрузить записи. Попробуйте позже."))
    } finally {
      setLoading(false)
    }
  }, [phone, t])

  const handleRepeat = useCallback(
    (masterId: string, serviceId?: string) => {
      // Navigate to master booking page (service preselection can be added later)
      router.push(`/${masterId}`)
    },
    [router]
  )

  const now = useMemo(() => new Date(), [])

  // Split appointments into upcoming and past
  const { upcoming, past } = useMemo(() => {
    if (!appointments) return { upcoming: [], past: [] }

    const up: AppointmentData[] = []
    const pa: AppointmentData[] = []

    for (const a of appointments) {
      const apptDate = new Date(a.date)
      if (apptDate >= now && a.status !== "CANCELLED") {
        up.push(a)
      } else {
        pa.push(a)
      }
    }

    // Upcoming sorted ascending
    up.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    return { upcoming: up, past: pa }
  }, [appointments, now])

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
      case "CONFIRMED": return t("profile.statusConfirmed", "Подтверждена")
      case "PENDING": return t("profile.statusPending", "Ожидает")
      case "CANCELLED": return t("profile.statusCancelled", "Отменена")
      case "COMPLETED": return t("profile.statusCompleted", "Завершена")
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

  return (
    <main className="px-3 py-4 sm:p-6 relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">
      <BackButton />
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-lg mt-8 space-y-6">
        <h1 className="text-2xl font-bold text-text dark:text-dark-text text-center">
          {t("profile.title", "Мои записи")}
        </h1>
        <p className="text-sm text-muted dark:text-dark-muted text-center">
          {t("profile.subtitle", "Введите номер телефона, чтобы увидеть ваши записи")}
        </p>

        {/* Phone input + search */}
        <Card className="!px-4 !py-4">
          <div className="space-y-3">
            <PhoneInput
              value={phone}
              onChange={setPhone}
              placeholder={t("form.phone", "+48 000 000 000")}
            />
            <button
              onClick={handleSearch}
              disabled={loading || phone.length < 5}
              className={`btn btn-primary w-full transition-all duration-200 ${
                loading || phone.length < 5
                  ? "opacity-60 pointer-events-none"
                  : "hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t("common.loading", "Загрузка...")}
                </span>
              ) : (
                t("profile.search", "Найти записи")
              )}
            </button>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        </Card>

        {/* Results */}
        {appointments !== null && (
          <>
            {clientName && (
              <p className="text-center text-text dark:text-dark-text font-medium">
                {t("profile.hello", "Привет")}, {clientName}!
              </p>
            )}

            {appointments.length === 0 && (
              <Card className="!px-4 !py-6 text-center">
                <p className="text-muted dark:text-dark-muted">
                  {t("profile.noAppointments", "Записей не найдено для этого номера телефона.")}
                </p>
              </Card>
            )}

            {/* Upcoming appointments */}
            {upcoming.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-text dark:text-dark-text">
                  {t("profile.upcoming", "Предстоящие")}
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
                          {t("profile.master", "Мастер")}: {a.master.name}
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
                  {t("profile.past", "Прошедшие")}
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
                          {t("profile.master", "Мастер")}: {a.master.name}
                        </div>
                        <div className={`text-xs font-medium ${statusColor(a.status)}`}>
                          {statusLabel(a.status)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRepeat(a.master.id, a.service.id)}
                        className="btn btn-outline text-xs !px-3 !py-1.5 whitespace-nowrap ml-3 shrink-0"
                      >
                        {t("profile.repeat", "Повторить")}
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
