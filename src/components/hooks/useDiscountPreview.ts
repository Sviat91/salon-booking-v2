import { useCallback, useEffect, useState } from 'react'
import type { CodeStatus } from '@/lib/discounts/shared'

export interface DiscountPreview {
  originalPrice: number
  finalPrice: number
  percent: number | null
  label: string | null
  discountId: string | null
  codeStatus: CodeStatus
}

interface UseDiscountPreviewProps {
  masterId?: string
  serviceId?: string
  startISO?: string
  phone?: string
}

async function fetchPreview(
  body: { masterId: string; serviceId: string; startISO?: string | null; code?: string | null; phone?: string | null },
  signal?: AbortSignal
): Promise<DiscountPreview | null> {
  const res = await fetch('/api/discounts/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) return null
  return res.json() as Promise<DiscountPreview>
}

/**
 * Drives the booking-flow price preview. The automatic (no-code) preview
 * re-runs on every masterId/serviceId/startISO change (stage 'catalog'/'slot'
 * server-side, per AD-9). `applyCode` is a separate, explicitly-triggered
 * POST (stage 'final') — never called on keystroke, since the preview
 * endpoint is rate-limited (AD-9).
 */
export function useDiscountPreview({ masterId, serviceId, startISO, phone }: UseDiscountPreviewProps) {
  const [preview, setPreview] = useState<DiscountPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appliedCode, setAppliedCode] = useState<string | null>(null)

  useEffect(() => {
    if (!masterId || !serviceId) {
      setPreview(null)
      setAppliedCode(null)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetchPreview({ masterId, serviceId, startISO: startISO ?? null }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setPreview(result)
        setAppliedCode(null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('error')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [masterId, serviceId, startISO])

  const applyCode = useCallback(
    async (code: string) => {
      if (!masterId || !serviceId) return
      setLoading(true)
      setError(null)
      try {
        const result = await fetchPreview({ masterId, serviceId, startISO: startISO ?? null, code, phone: phone ?? null })
        setPreview(result)
        setAppliedCode(result?.codeStatus === 'valid' ? code : null)
      } catch {
        setError('error')
      } finally {
        setLoading(false)
      }
    },
    [masterId, serviceId, startISO, phone]
  )

  const clearCode = useCallback(() => {
    setAppliedCode(null)
    if (!masterId || !serviceId) {
      setPreview(null)
      return
    }
    setLoading(true)
    fetchPreview({ masterId, serviceId, startISO: startISO ?? null })
      .then(setPreview)
      .catch(() => setError('error'))
      .finally(() => setLoading(false))
  }, [masterId, serviceId, startISO])

  return { preview, loading, error, appliedCode, applyCode, clearCode }
}
