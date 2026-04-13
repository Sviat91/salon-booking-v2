"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import PhoneInput from "@/components/ui/PhoneInput"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export default function LinkBookingsCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const linkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/client/link-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to link bookings")
      }
      return data
    },
    onSuccess: (data) => {
      setMessage({
        type: "success",
        text: `Успешно! Привязано записей: ${data.linked}`,
      })
      setName("")
      setPhone("")
      queryClient.invalidateQueries({ queryKey: ["clientProfile"] })
      // Auto-hide success message after 5 seconds
      setTimeout(() => setMessage(null), 5000)
    },
    onError: (err: any) => {
      setMessage({ type: "error", text: err.message })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    
    if (name.trim().length < 2) {
      setMessage({ type: "error", text: "Имя слишком короткое" })
      return
    }
    if (phone.trim().length < 5) {
      setMessage({ type: "error", text: "Введите корректный номер телефона" })
      return
    }

    linkMutation.mutate()
  }

  return (
    <Card className="!px-4 !py-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-2 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
          {t("profile.linkBookingsTitle", "Привязать старые записи")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "profile.linkBookingsDesc",
            "Записывались к нам раньше без регистрации? Введите ваши имя и номер телефона точно так, как указывали при записи, чтобы добавить историю в личный кабинет."
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="linkName" className="text-foreground">{t("form.name", "Имя")}</Label>
          <Input
            id="linkName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder={t("form.namePlaceholder", "Иван")}
            className="h-11 border-input bg-background"
          />
        </div>

        <div className="grid gap-2 relative z-50">
          <Label htmlFor="linkPhone" className="text-foreground">{t("form.phone", "Телефон")}</Label>
          <PhoneInput
            value={phone}
            onChange={setPhone}
            placeholder={t("form.phonePlaceholder", "+1 000 000 0000")}
          />
        </div>

        {message && (
          <div className={`flex items-start gap-2 text-sm p-3 rounded-md ${
            message.type === "success" 
              ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900" 
              : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900"
          }`}>
            {message.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            )}
            <p className="leading-snug">{message.text}</p>
          </div>
        )}

        <Button disabled={linkMutation.isPending} type="submit" className="w-full mt-2">
          {linkMutation.isPending 
            ? t("common.searching", "Поиск записей...") 
            : t("profile.linkBookingsBtn", "Найти и привязать записи")}
        </Button>
      </form>
    </Card>
  )
}
