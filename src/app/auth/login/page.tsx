import { Suspense } from "react"
import { Metadata } from "next"
import LoginForm from "@/components/auth/LoginForm"
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons"
import Link from "next/link"
import prisma from "@/lib/prisma"

export const metadata: Metadata = {
  title: "Login | Somique Beauty",
  description: "Login to your account",
}

export default async function LoginPage() {
  const config = await prisma.tenantConfig.findFirst()
  
  const providers = {
    google: !!(config?.googleClientId && config?.googleClientSecret),
    apple: !!(config?.appleClientId && config?.applePrivateKey),
    telegram: !!(config?.telegramBotToken && config?.telegramBotUsername),
    telegramBotUsername: config?.telegramBotUsername,
  }

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 z-[-1] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 bg-card backdrop-blur-md p-8 sm:p-10 rounded-2xl shadow-lg border border-border text-foreground">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="inline-block mb-6">
            <span className="font-bold text-2xl tracking-tight text-primary">
              Somique <span className="opacity-70 font-light">beauty</span>
            </span>
          </Link>
          <h2 className="text-2xl font-normal tracking-tight text-foreground">
            Welcome Back
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to book appointments or manage your salon.
          </p>
        </div>

        {/* LoginForm uses useSearchParams() — requires Suspense boundary */}
        <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Loading…</div>}>
          <LoginForm />
        </Suspense>

        <SocialLoginButtons providers={providers} />

        <div className="flex flex-col space-y-4 text-center mt-6">
          <Link
            href="/auth/register"
            className="text-sm font-medium text-primary hover:underline transition-colors"
          >
            Don&apos;t have an account? Sign up
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            &larr; Back to Salon
          </Link>
        </div>
      </div>
    </div>
  )
}

