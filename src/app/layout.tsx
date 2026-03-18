import '../styles/globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import Providers from './providers'
import Footer from '../components/Footer'
import { getTenantConfig } from '@/lib/tenant'
import { cn } from "@/lib/utils"

export const dynamic = 'force-dynamic'

const inter = Inter({ subsets: ['latin'] })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://somique.beauty'

// Dynamic metadata — reads brand name and favicon from TenantConfig
export async function generateMetadata(): Promise<Metadata> {
  const config = await getTenantConfig()
  const title = config.brandName || 'Somique Beauty'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faviconUrl = (config as any).faviconUrl || '/logo.png'

  return {
    metadataBase: new URL(siteUrl),
    title,
    description: 'Zarezerwuj wizytę. Szybka i wygodna rezerwacja online.',
    keywords: ['masaż twarzy', 'beauty', 'kosmetologia', 'rezerwacja online', 'spa', 'relaks'],
    icons: {
      icon:     faviconUrl,
      shortcut: faviconUrl,
      apple:    faviconUrl,
    },
    openGraph: {
      type: 'website',
      siteName: title,
      url: '/',
      title,
      description: 'Zarezerwuj wizytę. Szybka i wygodna rezerwacja online.',
      locale: 'pl_PL',
      images: [{ url: '/prev.png', width: 1200, height: 630, alt: title, type: 'image/png' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: 'Zarezerwuj wizytę. Szybka i wygodna rezerwacja online.',
      images: [{ url: '/prev.png', alt: title }],
    },
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const config = await getTenantConfig()

  return (
    <html lang="pl" className={cn("font-sans")}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var shouldBeDark = saved === 'dark' || (!saved && prefersDark);
                  
                  if (shouldBeDark) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --color-primary: ${config.primaryColor};
              --color-secondary: ${config.secondaryColor};
              --color-accent: ${config.accentColor};
              --color-text: ${config.textColor};
              --color-muted: ${config.mutedColor};
              --color-border: ${config.borderColor};
              --color-card: ${(config as Record<string, unknown>).cardColor || '#FFFFFF'};
              --color-success: ${config.successColor};
              --color-error: ${config.errorColor};
              
              /* Dark mode colors */
              --color-dark-bg: ${config.darkBgColor};
              --color-dark-primary: ${(config as Record<string, unknown>).darkPrimaryColor || config.primaryColor};
              --color-dark-accent: ${(config as Record<string, unknown>).darkAccentColor || config.accentColor};
              --color-dark-text: ${config.darkTextColor};
              --color-dark-muted: ${config.darkMutedColor};
              --color-dark-border: ${config.darkBorderColor};
              --color-dark-card: ${config.darkCardColor};
            }
          `
        }} />
        <script
          async
          src="https://stats.theboatscanner.com/script.js"
          data-website-id="8b85b843-7c23-4ec0-8487-423567d0d111"
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen flex flex-col text-foreground">
            <div className="flex-1 w-full mx-auto">
              {children}
            </div>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  )
}
