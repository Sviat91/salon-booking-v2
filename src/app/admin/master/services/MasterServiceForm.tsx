"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"
import LocalizedFieldInput from "@/components/admin/LocalizedFieldInput"
import type { Language } from "@/lib/i18n-shared"

type Service = {
  id: string
  name_pl: string
  name_en: string | null
  name_uk: string | null
  duration: number
  price: number
}

interface MasterServiceFormProps {
  service?: Service
  enabledLocales: Language[]
  onSuccess: () => void
}

export default function MasterServiceForm({ service, enabledLocales, onSuccess }: MasterServiceFormProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const name_pl = formData.get("name_pl") as string
    const duration = parseInt(formData.get("duration") as string, 10)
    const price = parseFloat(formData.get("price") as string)
    const body: Record<string, unknown> = { name_pl, duration, price }
    if (formData.has("name_en")) body.name_en = formData.get("name_en")
    if (formData.has("name_uk")) body.name_uk = formData.get("name_uk")

    try {
      const url = service ? `/api/master/services/${service.id}` : "/api/master/services"
      const method = service ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.code ? t(apiErrorKey(errData.code)) : t('admin.services.saveFailed'))
      }

      router.refresh()
      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <LocalizedFieldInput
        baseName="name"
        label={t('admin.services.serviceName')}
        values={{ pl: service?.name_pl, en: service?.name_en, uk: service?.name_uk }}
        enabledLocales={enabledLocales}
        placeholder={t('admin.services.servicePlaceholderMaster')}
        required
      />

      <div className="grid gap-1.5">
        <Label htmlFor="duration">{t('admin.services.durationLabel')}</Label>
        <Input
          id="duration"
          name="duration"
          type="number"
          min={5}
          max={480}
          defaultValue={service?.duration ?? 60}
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="price">{t('admin.services.priceZl')}</Label>
        <Input
          id="price"
          name="price"
          type="number"
          min={0}
          step={0.01}
          defaultValue={service?.price ?? ""}
          placeholder="0.00"
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} className="mt-2">
        {loading ? t('common.saving') : service ? t('admin.services.updateServiceBtn') : t('admin.services.addServiceTitle')}
      </Button>
    </form>
  )
}
