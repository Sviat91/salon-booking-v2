import '../styles/globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import Providers from './providers'
import Footer from '../components/Footer'

const inter = Inter({ subsets: ['latin'] })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://somique.beauty'
const metadataTitle = 'Somique Beauty'
const metadataDescription = 'Zarezerwuj wizytę w Somique Beauty. Szybka i wygodna rezerwacja online.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: metadataTitle,
  description: metadataDescription,
  keywords: ['masaż twarzy', 'beauty', 'kosmetologia', 'rezerwacja online', 'somique beauty', 'spa', 'relaks'],
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Somique Beauty',
    url: '/',
    title: metadataTitle,
    description: metadataDescription,
    locale: 'pl_PL',
    images: [
      {
        url: '/prev.png',
        width: 1200,
        height: 630,
        alt: 'Somique Beauty',
        type: 'image/png',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: metadataTitle,
    description: metadataDescription,
    images: [
      {
        url: '/prev.png',
        alt: 'Somique Beauty',
      }
    ],
  },
}


import { getTenantConfig } from '@/lib/tenant'
import { cn } from "@/lib/utils";
import Header from "@/components/layout/Header";

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
              --color-success: ${config.successColor};
              --color-error: ${config.errorColor};
              
              /* Dark mode colors */
              --color-dark-bg: ${config.darkBgColor};
              --color-dark-text: ${config.darkTextColor};
              --color-dark-muted: ${config.darkMutedColor};
              --color-dark-border: ${config.darkBorderColor};
              --color-dark-card: ${config.darkCardColor};
              --color-primary-dark: ${config.darkBgColor}; /* Fallback for legacy ref */
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
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            <Header />
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
