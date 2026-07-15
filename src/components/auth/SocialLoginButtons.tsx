"use client"
import React, { useEffect, useRef } from 'react'
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { signIn } from "next-auth/react"

declare global {
  interface Window {
    onTelegramAuth: (user: any) => void
  }
}

export interface SocialProvidersConfig {
  google: boolean
  apple: boolean
  telegram: boolean
  telegramBotUsername?: string | null
}

export function SocialLoginButtons({ providers }: { providers: SocialProvidersConfig }) {
  const { t } = useTranslation()
  const telegramWrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Inject Telegram widget script
    if (providers.telegram && providers.telegramBotUsername && telegramWrapperRef.current) {
      telegramWrapperRef.current.innerHTML = '' // clear previous
      const script = document.createElement("script")
      script.src = "https://telegram.org/js/telegram-widget.js?22"
      script.setAttribute("data-telegram-login", providers.telegramBotUsername)
      script.setAttribute("data-size", "large")
      script.setAttribute("data-userpic", "false")
      script.setAttribute("data-radius", "8")
      script.setAttribute("data-request-access", "write")
      script.setAttribute("data-onauth", "onTelegramAuth(user)")
      
      window.onTelegramAuth = (user: any) => {
        // user object contains: id, first_name, last_name, username, photo_url, auth_date, hash
        signIn("telegram", {
           ...user,
           callbackUrl: "/"
        })
      }
      telegramWrapperRef.current.appendChild(script)
    }
  }, [providers.telegram, providers.telegramBotUsername])

  const hasAnyProvider = providers.google || providers.apple || providers.telegram
  if (!hasAnyProvider) {
    return null
  }

  return (
    <div className="flex flex-col gap-3 w-full animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{t('auth.orContinueWith', 'Or continue with')}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {providers.google && (
           <Button 
             variant="outline" 
             type="button" 
             onClick={() => signIn("google", { callbackUrl: "/" })} 
             className="w-full h-11 relative border border-[#747775] bg-white text-[#1f1f1f] hover:bg-[#f2f2f2]/90 hover:text-[#1f1f1f] dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1e1e1e]/90 dark:hover:text-[#e3e3e3]"
           >
             <svg className="absolute left-4 h-5 w-5" viewBox="0 0 24 24">
               <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
               <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
               <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
               <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
             </svg>
             <span className="font-medium font-roboto">{t('auth.continueWithGoogle', 'Continue with Google')}</span>
           </Button>
        )}

        {providers.apple && (
           <Button 
             variant="outline" 
             type="button" 
             onClick={() => signIn("apple", { callbackUrl: "/" })} 
             className="w-full h-11 relative border border-black bg-white text-black hover:bg-gray-100 hover:text-black dark:border-white dark:bg-black dark:text-white dark:hover:bg-zinc-900 dark:hover:text-white"
           >
             <svg className="absolute left-4 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
               <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.68.727-1.303 2.208-1.12 3.518 1.341.104 2.56-.701 3.407-1.506z" />
             </svg>
             <span className="font-medium font-sans">{t('auth.continueWithApple', 'Continue with Apple')}</span>
           </Button>
        )}

        {providers.telegram && (
           <div className="flex flex-col items-center justify-center mt-2 w-full min-h-[44px] overflow-hidden rounded-md border border-transparent">
             <div ref={telegramWrapperRef} className="flex justify-center scale-105" />
           </div>
        )}
      </div>
    </div>
  )
}
