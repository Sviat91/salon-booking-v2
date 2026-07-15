import { Metadata } from "next"
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm"
import { AuthFooterLinks } from "@/components/auth/AuthFooterLinks"
import { BrandNameDisplay } from "@/components/auth/BrandNameDisplay"
import Link from "next/link"
import prisma from "@/lib/prisma"

export async function generateMetadata(): Promise<Metadata> {
  const config = await prisma.tenantConfig.findFirst()
  return {
    title: `Password Reset | ${config?.brandName || 'Salon Booking'}`,
    description: "Reset your account password",
  }
}

export default async function ForgotPasswordPage() {
  const config = await prisma.tenantConfig.findFirst()

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 z-[-1] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 bg-card backdrop-blur-md p-8 sm:p-10 rounded-2xl shadow-lg border border-border text-foreground">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="inline-block mb-6">
            <span className="font-bold text-2xl tracking-tight text-primary">
              <BrandNameDisplay brandName={config?.brandName || 'Salon Booking'} />
            </span>
          </Link>
        </div>

        <ForgotPasswordForm />

        <AuthFooterLinks variant="back-to-login" />
      </div>
    </div>
  )
}
