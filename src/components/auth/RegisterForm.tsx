"use client"
import * as React from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import PhoneInput from "@/components/ui/PhoneInput"
import { clientLog } from "@/lib/client-logger"

type RegisterFormProps = React.HTMLAttributes<HTMLDivElement>

export default function RegisterForm({ className, ...props }: RegisterFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)

  const [phone, setPhone] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const passMismatch = !!(password && confirmPassword && password !== confirmPassword)

  const [consentDataProcessing, setConsentDataProcessing] = React.useState(false)
  const [consentTerms, setConsentTerms] = React.useState(false)
  const [consentNotifications, setConsentNotifications] = React.useState(false)

  const { t } = useTranslation()

  // Turnstile
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string | undefined
  const turnstileRef = React.useRef<HTMLDivElement | null>(null)
  const widgetIdRef = React.useRef<string | null>(null)
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null)
  const turnstileTokenRef = React.useRef<string | null>(null)

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
            callback: (token: string) => {
              setTurnstileToken(token)
              turnstileTokenRef.current = token
            },
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
    turnstileTokenRef.current = null
    const turnstile = (window as any)?.turnstile
    if (turnstile && widgetIdRef.current) {
      try { turnstile.reset(widgetIdRef.current) } catch (error) { clientLog.warn('Turnstile reset failed:', error) }
    }
  }, [])

  async function waitForFreshTurnstileToken(previous: string | null, timeoutMs = 4000): Promise<string | null> {
    if (!siteKey) return null
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const current = turnstileTokenRef.current
      if (current && current !== previous) return current
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return null
  }

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    const form = event.target as HTMLFormElement
    const name = (form.elements.namedItem('name') as HTMLInputElement).value
    const email = (form.elements.namedItem('email') as HTMLInputElement).value

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch', 'Passwords do not match'))
      setIsLoading(false)
      return
    }

    if (!consentDataProcessing || !consentTerms) {
      setError(t('consent.requiredForRegistration', 'Please accept required consents to register'))
      setIsLoading(false)
      return
    }

    try {
      const normalizedPhone = phone.trim()
      const phoneDigits = normalizedPhone.replace(/\D/g, '')
      const phonePayload = phoneDigits.length >= 6 ? normalizedPhone : null

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          phone: phonePayload,
          consents: {
            dataProcessing: consentDataProcessing,
            terms: consentTerms,
            notifications: consentNotifications,
          },
          turnstileToken,
        }),
      })

      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.error || t('auth.registrationFailed', 'Registration failed'))
      }

      // Turnstile tokens are single-use — /api/auth/register just consumed ours,
      // and the login guard in src/auth.ts now requires a valid one. Reset the
      // widget and wait briefly for a fresh token; on timeout we fall through to
      // the existing "sign in manually" fallback below.
      const consumed = turnstileTokenRef.current
      resetTurnstile()
      const freshToken = await waitForFreshTurnstileToken(consumed)

      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
        ...(freshToken ? { turnstileToken: freshToken } : {}),
        callbackUrl: "/profile",
      })

      if (res?.error) {
        setError(t('auth.autoLoginFailed', 'Failed to auto-login. Please sign in manually.'))
        setTimeout(() => router.push('/auth/login'), 2000)
      } else if (res?.url) {
        window.location.href = res.url
      }
    } catch (err: any) {
      setError(err.message || t('auth.registrationError', 'An error occurred during registration. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <div className="text-center">
        <h2 className="text-2xl font-normal tracking-tight text-foreground">
          {t('auth.registerTitle', 'Create an Account')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('auth.registerSubtitle', 'Register to easily book and manage your appointments.')}
        </p>
      </div>
      <form onSubmit={onSubmit}>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name" className="text-foreground">{t('form.name', 'Full Name')}</Label>
            <Input
              id="name"
              name="name"
              placeholder={t('form.namePlaceholder', 'John Doe')}
              type="text"
              autoCapitalize="words"
              autoComplete="name"
              disabled={isLoading}
              required
              className="h-11 border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50"
            />
          </div>

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

          <div className="grid gap-2 relative z-50">
            <Label htmlFor="phone" className="text-foreground">{t('form.phone', 'Phone')} ({t('form.optional', 'optional')})</Label>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              placeholder={t('form.phonePlaceholder', '+1 000 000 0000')}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password" className="text-foreground">{t('form.password', 'Password')}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              disabled={isLoading}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirmPassword" className={`text-foreground ${passMismatch ? 'text-destructive' : ''}`}>
              {t('form.confirmPassword', 'Confirm Password')}
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              disabled={isLoading}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`h-11 bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring/50 ${
                passMismatch
                  ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive'
                  : 'border-input focus-visible:border-ring'
              }`}
            />
            {passMismatch && (
              <span className="text-xs font-medium text-destructive mt-1">
                {t('auth.passwordsDoNotMatch', 'Passwords do not match')}
              </span>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border/70 p-3 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={consentTerms}
                onChange={(e) => setConsentTerms(e.target.checked)}
                disabled={isLoading}
                className="mt-0.5"
              />
              <span>
                {t('consent.termsCheckbox', 'I have read and accept the')} {" "}
                <a href="/terms" target="_blank" className="underline">{t('consent.termsLink', 'Terms of Service')}</a> <span className="text-red-500">*</span>
              </span>
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={consentDataProcessing}
                onChange={(e) => setConsentDataProcessing(e.target.checked)}
                disabled={isLoading}
                className="mt-0.5"
              />
              <span>
                {t('consent.privacyCheckbox', 'I consent to the processing of my personal data in accordance with the')} {" "}
                <a href="/privacy" target="_blank" className="underline">{t('consent.privacyLink', 'Privacy Policy')}</a> <span className="text-red-500">*</span>
              </span>
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={consentNotifications}
                onChange={(e) => setConsentNotifications(e.target.checked)}
                disabled={isLoading}
                className="mt-0.5"
              />
              <span>{t('consent.notificationsCheckbox', 'I agree to receive booking notifications via phone/email (optional)')}</span>
            </label>
          </div>

          {error && <div className="text-sm font-medium text-destructive">{error}</div>}

          {/* Turnstile */}
          {siteKey && (
            <div className="flex justify-center">
              <div ref={turnstileRef} className="rounded-xl"></div>
            </div>
          )}

          <Button disabled={isLoading} type="submit" className="mt-2">
            {isLoading && (
              <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {t('auth.createAccount', 'Create Account')}
          </Button>
        </div>
      </form>
    </div>
  )
}
