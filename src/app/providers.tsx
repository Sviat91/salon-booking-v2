"use client"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRef } from 'react'
import { LayoutGroup } from 'framer-motion'
import { SessionProvider } from 'next-auth/react'
import { MasterProvider } from '@/contexts/MasterContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import AppToaster from '@/components/AppToaster'
import { ConfirmDialogProvider } from '@/components/ConfirmDialogProvider'

// Initialize i18n
import '@/lib/i18n'

export default function Providers({ children, enabledLocales }: { children: React.ReactNode; enabledLocales: string }) {
  const clientRef = useRef<QueryClient>()
  if (!clientRef.current) clientRef.current = new QueryClient({
    defaultOptions: {
      queries: { 
        staleTime: 0,
        gcTime: 30 * 60 * 1000, // 30 minutes - keep unused cache longer for better UX
        refetchOnWindowFocus: false,
      },
    }
  })

  // Prefetch moved to landing page (page.tsx) - prefetches for BOTH masters

  return (
    <ErrorBoundary>
      <SessionProvider>
        <QueryClientProvider client={clientRef.current}>
          <LanguageProvider enabledLocales={enabledLocales}>
            <ConfirmDialogProvider>
              <MasterProvider>
                <LayoutGroup>
                  {children}
                </LayoutGroup>
              </MasterProvider>
            </ConfirmDialogProvider>
            <AppToaster />
          </LanguageProvider>
        </QueryClientProvider>
      </SessionProvider>
    </ErrorBoundary>
  )
}

