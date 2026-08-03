"use client"
import * as React from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { clientLog } from "@/lib/client-logger"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"

type ForgotPasswordFormProps = React.HTMLAttributes<HTMLDivElement>

export default function ForgotPasswordForm({ className, ...props }: ForgotPasswordFormProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [isSent, setIsSent] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const { t } = useTranslation()

  // Turnstile
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string | undefined
  const turnstileRef = React.useRef<HTMLDivElement | null>(null)
  const widgetIdRef = React.useRef<string | null>(null)
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null)

  // Load Turnstile
  React.useEffect(() => {
    if (!siteKey) return
    const scriptId = 'cf-turnstile'
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    const interval = setInterval(() => {
      const turnstile = (window as any)?.turnstile
      if (turnstile && turnstileRef.current && !widgetIdRef.current) {
        try {
          widgetIdRef.current = turnstile.render(turnstileRef.current, {
            sitekey: siteKey,
            language: 'pl',
            callback: (token: string) => setTurnstileToken(token),
          })
          clearInterval(interval)
        } catch (error) {
          clientLog.warn('Turnstile render failed:', error)
        }
      }
    }, 200)

    return () => {
      clearInterval(interval)
      if (turnstileRef.current && widgetIdRef.current) {
        const turnstile = (window as any)?.turnstile
        if (turnstile) {
          try {
            turnstile.remove(widgetIdRef.current)
          } catch (error) {
            clientLog.warn('Turnstile cleanup failed:', error)
          }
        }
      }
      widgetIdRef.current = null
    }
  }, [siteKey])

  const resetTurnstile = React.useCallback(() => {
    setTurnstileToken(null)
    const turnstile = (window as any)?.turnstile
    if (turnstile && widgetIdRef.current) {
      try { turnstile.reset(widgetIdRef.current) } catch (error) { clientLog.warn('Turnstile reset failed:', error) }
    }
  }, [])

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    const form = event.target as HTMLFormElement
    const email = (form.elements.namedItem('email') as HTMLInputElement).value

    if (siteKey && !turnstileToken) {
      setError(t('auth.captchaRequired'))
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken }),
      })

      const data = await res.json()

      if (!res.ok) {
        resetTurnstile()
        setError(data.code ? t(apiErrorKey(data.code)) : (data.error || t('errors.generic')))
      } else {
        setIsSent(true)
      }
    } catch (e) {
      setError(t('errors.generic'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <div className="text-center">
        <h2 className="text-2xl font-normal tracking-tight text-foreground">
          {t('auth.forgotPasswordTitle', 'Reset your password')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('auth.forgotPasswordDesc', 'Enter your email to receive a password reset link.')}
        </p>
      </div>

      {isSent ? (
        <div className="text-center">
          <div className="text-4xl mb-2">✉️</div>
          <h3 className="text-xl font-bold">{t('auth.forgotPasswordSentTitle', 'Check your email')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('auth.forgotPasswordSentDesc', "If this email is registered, you'll receive a password reset link shortly.")}
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-foreground">{t('form.email', 'Email')}</Label>
              <Input
                id="email"
                name="email"
                placeholder={t('form.emailPlaceholder', 'client@example.com')}
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                disabled={isLoading}
                required
                className="h-11 border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50"
              />
            </div>
            {error && (
              <div className="text-sm font-medium text-destructive">
                {error}
              </div>
            )}
            {siteKey && (
              <div className="flex justify-center">
                <div ref={turnstileRef} className="rounded-xl" />
              </div>
            )}
            <Button disabled={isLoading} type="submit" className="mt-2">
              {isLoading && (
                <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {t('auth.forgotPasswordSubmit', 'Send reset link')}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
