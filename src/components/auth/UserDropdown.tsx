"use client"

import * as React from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { useTranslation } from "react-i18next"
import { User, LogOut, Settings, LayoutDashboard, LogIn, UserPlus } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export default function UserDropdown() {
  const { data: session, status } = useSession()
  const { t } = useTranslation()

  if (status === "loading") {
    return (
      <div className="p-2.5 rounded-full bg-muted animate-pulse">
        <div className="h-5 w-5" />
      </div>
    )
  }

  // Determine dashboard URL based on role
  const dashboardUrl = session?.user?.role === "CLIENT" 
    ? "/profile" 
    : session?.user?.role === "MASTER" 
      ? "/admin/master" 
      : "/admin"

  const dashboardIcon = session?.user?.role === "CLIENT" ? <User className="mr-2 h-4 w-4" /> : <LayoutDashboard className="mr-2 h-4 w-4" />
  const dashboardLabel = session?.user?.role === "CLIENT" ? t("profile.title", "My Profile") : "Dashboard"

  return (
    <DropdownMenu>
      {/* @ts-ignore */}
      <DropdownMenuTrigger asChild>
        <button
          className="p-2.5 rounded-full bg-primary text-primary-foreground hover:ring-2 hover:ring-primary/40 hover:shadow-md transition focus:ring-2 focus:ring-primary/50 outline-none flex items-center justify-center"
          title={session ? t("profile.menu", "Menu") : t("auth.login", "Sign In")}
        >
          <User className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 mt-2">
        {session ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1 text-sm">
                  <p className="font-medium text-foreground leading-none">
                    {session.user.name || session.user.email}
                  </p>
                  {session.user.name && (
                    <p className="text-xs text-muted-foreground leading-none mt-1">
                      {session.user.email}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* @ts-ignore */}
            <DropdownMenuItem asChild className="focus:bg-primary focus:text-primary-foreground">
              <Link href={dashboardUrl} className="cursor-pointer w-full flex items-center">
                {dashboardIcon}
                <span>{dashboardLabel}</span>
              </Link>
            </DropdownMenuItem>
            {session.user.role === "CLIENT" && (
              /* @ts-ignore */
              <DropdownMenuItem asChild className="focus:bg-primary focus:text-primary-foreground">
                <Link href="/profile/edit" className="cursor-pointer w-full flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>{t("profile.editProfile", "Profile Settings")}</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-red-500 focus:bg-red-50 dark:focus:bg-red-950/30"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t("profile.signOut", "Sign Out")}</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("auth.welcome", "Welcome")}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* @ts-ignore */}
            <DropdownMenuItem asChild className="focus:bg-primary focus:text-primary-foreground">
              <Link href="/auth/login" className="cursor-pointer w-full flex items-center">
                <LogIn className="mr-2 h-4 w-4" />
                <span>{t("auth.signIn", "Sign In")}</span>
              </Link>
            </DropdownMenuItem>
            {/* @ts-ignore */}
            <DropdownMenuItem asChild className="focus:bg-primary focus:text-primary-foreground">
              <Link href="/auth/register" className="cursor-pointer w-full flex items-center">
                <UserPlus className="mr-2 h-4 w-4" />
                <span>{t("auth.signUp", "Sign Up")}</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
