import { Suspense } from "react"
import { Metadata } from "next"
import ResetPasswordForm from "@/components/auth/ResetPasswordForm"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Create New Password | Somique Beauty",
  description: "Create a new password for your account",
}

export default function ResetPasswordPage() {
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
            Create new password
          </h2>
        </div>

        <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>

        <div className="flex flex-col space-y-4 text-center mt-6">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            &larr; Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
