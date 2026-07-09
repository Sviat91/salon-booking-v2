import { Metadata } from "next"
import RegisterForm from "@/components/auth/RegisterForm"
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons"
import Link from "next/link"
import prisma from "@/lib/prisma"

export const metadata: Metadata = {
  title: "Register | Somique Beauty",
  description: "Create your client account",
}

export default async function RegisterPage() {
  const config = await prisma.tenantConfig.findFirst()
  
  const providers = {
    google: !!(config?.googleClientId && config?.googleClientSecret),
    apple: !!(config?.appleClientId && config?.applePrivateKey),
    telegram: !!(config?.telegramBotToken && config?.telegramBotUsername),
    telegramBotUsername: config?.telegramBotUsername,
  }

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background radial gradient matches main theme */}
      <div className="absolute inset-0 z-[-1] pointer-events-none" />
      
      <div className="w-full max-w-md space-y-8 bg-card backdrop-blur-md p-8 sm:p-10 rounded-2xl shadow-lg border border-border text-foreground">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="inline-block mb-6">
            <span className="font-bold text-2xl tracking-tight text-primary">
              Somique <span className="opacity-70 font-light">beauty</span>
            </span>
          </Link>
          <h2 className="text-2xl font-normal tracking-tight text-foreground">
            Create an Account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Register to easily book and manage your appointments.
          </p>
        </div>
        
        <RegisterForm />
        
        <SocialLoginButtons providers={providers} />
        
        <div className="flex flex-col space-y-4 text-center mt-6">
          <Link 
            href="/auth/login" 
            className="text-sm font-medium text-primary hover:underline transition-colors"
          >
            Already have an account? Sign in
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

