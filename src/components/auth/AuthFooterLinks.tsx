"use client"
import Link from "next/link"
import { useTranslation } from "react-i18next"

interface AuthFooterLinksProps {
  variant: "login" | "register" | "back-to-login"
}

/**
 * Bottom navigation links shown under the auth forms (sign up/sign in prompt,
 * back to salon/login). Kept as its own tiny client component so the Server
 * Component page wrappers (src/app/auth/[page]/page.tsx) don't need to become
 * client components just to translate this text.
 */
export function AuthFooterLinks({ variant }: AuthFooterLinksProps) {
  const { t } = useTranslation()

  if (variant === "back-to-login") {
    return (
      <div className="flex flex-col space-y-4 text-center mt-6">
        <Link
          href="/auth/login"
          className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          &larr; {t('auth.backToLogin', 'Back to sign in')}
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-4 text-center mt-6">
      {variant === "login" ? (
        <Link
          href="/auth/register"
          className="text-sm font-medium text-primary hover:underline transition-colors"
        >
          {t('auth.noAccountSignUp', "Don't have an account? Sign up")}
        </Link>
      ) : (
        <Link
          href="/auth/login"
          className="text-sm font-medium text-primary hover:underline transition-colors"
        >
          {t('auth.haveAccountSignIn', 'Already have an account? Sign in')}
        </Link>
      )}
      <Link
        href="/"
        className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        &larr; {t('auth.backToSalon', 'Back to Salon')}
      </Link>
    </div>
  )
}
