import { Suspense } from "react"
import { Metadata } from "next"
import ResetPasswordForm from "@/components/auth/ResetPasswordForm"
import { AuthFooterLinks } from "@/components/auth/AuthFooterLinks"
import { BrandNameDisplay } from "@/components/auth/BrandNameDisplay"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { DEFAULT_BRAND_NAME } from "@/lib/constants/brand"

export async function generateMetadata(): Promise<Metadata> {
  const config = await prisma.tenantConfig.findFirst()
  return {
    title: `Create New Password | ${config?.brandName || DEFAULT_BRAND_NAME}`,
    description: "Create a new password for your account",
  }
}

export default async function ResetPasswordPage() {
  const config = await prisma.tenantConfig.findFirst()

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 z-[-1] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 bg-card backdrop-blur-md p-8 sm:p-10 rounded-2xl shadow-lg border border-border text-foreground">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="inline-block mb-6">
            <span className="font-bold text-2xl tracking-tight text-primary">
              <BrandNameDisplay brandName={config?.brandName || DEFAULT_BRAND_NAME} />
            </span>
          </Link>
        </div>

        <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>

        <AuthFooterLinks variant="back-to-login" />
      </div>
    </div>
  )
}
