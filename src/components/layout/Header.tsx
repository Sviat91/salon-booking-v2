"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { useSession, signOut } from "next-auth/react"
import { LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import ThemeToggle from "@/components/ThemeToggle"
import UserDropdown from "@/components/auth/UserDropdown"
import { DEFAULT_BRAND_NAME } from "@/lib/constants/brand"

interface HeaderProps {
  brandName?: string;
  logoUrl?: string | null;
}

export default function Header({ brandName = DEFAULT_BRAND_NAME, logoUrl }: HeaderProps) {
  const { t } = useTranslation()
  const { data: session } = useSession()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-8 w-auto" />
            ) : (
              <span className="font-bold inline-block text-xl tracking-tight text-primary">
                {brandName}
              </span>
            )}
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link
              href="/"
              className="flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground/80"
            >
              {t('common.home', 'Home')}
            </Link>
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            <UserDropdown />
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  )
}
