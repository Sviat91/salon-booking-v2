"use client"
import * as React from "react"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type UserAuthFormProps = React.HTMLAttributes<HTMLDivElement>

export default function LoginForm({ className, ...props }: UserAuthFormProps) {
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const { t } = useTranslation()

  const callbackUrl = searchParams.get('callbackUrl')
  const errorParam = searchParams.get('error')
  const resetParam = searchParams.get('reset')

  React.useEffect(() => {
    if (errorParam === 'CredentialsSignin') {
      setError(t('auth.invalidCredentials', 'Invalid email or password'))
    }
  }, [errorParam])

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    const form = event.target as HTMLFormElement
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
        ...(callbackUrl ? { callbackUrl } : {}),
      })

      if (res?.error) {
        setError(t('auth.invalidCredentials', 'Invalid email or password'))
      } else {
        if (callbackUrl) {
          window.location.href = callbackUrl
        } else {
          // Redirect to login page again so the middleware can intercept and route by role
          window.location.href = '/auth/login'
        }
      }
    } catch {
      setError(t('auth.loginError', 'An error occurred. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <form onSubmit={onSubmit}>
        <div className="grid gap-4">
          {resetParam === 'success' && (
            <div className="bg-green-500/10 text-green-500 p-3 rounded-lg text-sm border border-green-500/20 text-center font-medium">
              {t('auth.resetPasswordSuccessDesc', 'Password updated successfully. You can now sign in.')}
            </div>
          )}
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
          <div className="grid gap-2">
            <Label htmlFor="password" className="text-foreground">{t('form.password', 'Password')}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
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
          <div className="flex justify-end mt-1">
            <a 
              href="/auth/forgot-password" 
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              {t('auth.forgotPassword', 'Forgot password?')}
            </a>
          </div>
          <Button disabled={isLoading} type="submit" className="mt-2">
            {isLoading && (
              <svg
                className="mr-2 h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            )}
            {t('auth.signIn', 'Sign In')}
          </Button>
        </div>
      </form>
    </div>
  )
}

