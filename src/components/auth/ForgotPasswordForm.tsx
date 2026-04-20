"use client"
import * as React from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ForgotPasswordFormProps = React.HTMLAttributes<HTMLDivElement>

export default function ForgotPasswordForm({ className, ...props }: ForgotPasswordFormProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [isSent, setIsSent] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const { t } = useTranslation()

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    const form = event.target as HTMLFormElement
    const email = (form.elements.namedItem('email') as HTMLInputElement).value

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'An error occurred. Please try again.')
      } else {
        setIsSent(true)
      }
    } catch (e) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSent) {
    return (
      <div className={cn("grid gap-6 text-center", className)} {...props}>
        <div className="text-4xl mb-2">✉️</div>
        <h3 className="text-xl font-bold">{t('auth.forgotPasswordSentTitle', 'Check your email')}</h3>
        <p className="text-muted-foreground text-sm">
          {t('auth.forgotPasswordSentDesc', "If this email is registered, you'll receive a password reset link shortly.")}
        </p>
      </div>
    )
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
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
    </div>
  )
}
