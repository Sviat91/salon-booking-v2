"use client"
import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

type ResetPasswordFormProps = React.HTMLAttributes<HTMLDivElement>

export default function ResetPasswordForm({ className, ...props }: ResetPasswordFormProps) {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<boolean>(false)
  const { t } = useTranslation()

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    const form = event.target as HTMLFormElement
    const newPassword = (form.elements.namedItem('password') as HTMLInputElement).value
    const confirmPassword = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value

    if (newPassword !== confirmPassword) {
      setError(t('auth.resetPasswordMismatch', 'Passwords do not match.'))
      setIsLoading(false)
      return
    }
    
    if (newPassword.length < 6) {
      setError(t('auth.resetPasswordTooShort', 'Password must be at least 6 characters.'))
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error === 'invalid_token' || data.error === 'token_expired'
          ? t('auth.resetTokenInvalid', 'This link has expired or is invalid.')
          : data.error || t('errors.generic'))
      } else {
        setSuccess(true)
        // Redirect to login page internally rather than immediately switching context.
        setTimeout(() => {
          window.location.href = '/auth/login?reset=success'
        }, 2000)
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
          {t('auth.resetPasswordTitle', 'Create new password')}
        </h2>
      </div>

      {!token ? (
        <div className="text-center">
          <p className="text-destructive mb-4">{t('auth.resetTokenInvalid', 'This link is invalid or has expired.')}</p>
          <Link href="/auth/forgot-password">
            <Button variant="outline">{t('auth.requestNewLink', 'Request new link')}</Button>
          </Link>
        </div>
      ) : success ? (
        <div className="text-center">
          <div className="text-4xl mb-4 text-green-500">✓</div>
          <h3 className="text-xl font-bold mb-2">{t('auth.resetPasswordSuccess', 'Password updated successfully!')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('auth.resetPasswordSuccessDesc', 'You will be redirected to the login page shortly.')}
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-foreground">{t('auth.resetPasswordNew', 'New password')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                disabled={isLoading}
                required
                className="h-11 border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword" className="text-foreground">{t('auth.resetPasswordConfirm', 'Confirm password')}</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                disabled={isLoading}
                required
                className="h-11 border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50"
              />
            </div>
            {error && (
              <div className="text-sm font-medium text-destructive">
                {error}
                {(error === t('auth.resetTokenInvalid', 'This link has expired or is invalid.') || error === 'invalid_token' || error === 'token_expired') && (
                  <div className="mt-3">
                    <Link href="/auth/forgot-password">
                      <Button variant="outline" size="sm" type="button" className="w-full">
                        {t('auth.requestNewLink', 'Request new link')}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
            <Button disabled={isLoading} type="submit" className="mt-2">
              {isLoading && (
                <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {t('auth.resetPasswordSubmit', 'Set new password')}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
