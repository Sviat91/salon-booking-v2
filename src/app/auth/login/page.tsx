import { Metadata } from "next"
import LoginForm from "@/components/auth/LoginForm"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Login | Somique Beauty",
  description: "Login to your account",
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background radial gradient matches main theme */}
      <div className="absolute inset-0 z-[-1] pointer-events-none" />
      
      <div className="w-full max-w-md space-y-8 bg-background/80 backdrop-blur-md p-8 sm:p-10 rounded-2xl shadow-xl border border-border/50">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="inline-block mb-6">
            <span className="font-bold text-2xl tracking-tight text-primary">
              Somique <span className="opacity-70 font-light">beauty</span>
            </span>
          </Link>
          <h2 className="text-3xl font-extrabold tracking-tight">
            Welcome Back
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to book appointments or manage your salon.
          </p>
        </div>
        
        <LoginForm />
        
        <div className="flex flex-col space-y-4 text-center mt-6">
          <Link 
            href="/auth/register" 
            className="text-sm font-medium text-primary hover:underline transition-colors"
          >
            Don't have an account? Sign up
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
