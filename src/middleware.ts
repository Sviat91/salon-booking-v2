import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import NextAuth from "next-auth"
import authConfig from "./auth.config"

const { auth } = NextAuth(authConfig)
export async function middleware(request: NextRequest) {
  const session = await auth()
  const { pathname } = request.nextUrl

  // Protect /admin routes
  if (pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url))
    }

    const role = session.user?.role

    // Master wants to access superadmin area (/admin but not /admin/master)
    if (role === "MASTER" && pathname === "/admin") {
      return NextResponse.redirect(new URL("/admin/master", request.url))
    }

    // Client trying to access admin
    if (role === "CLIENT") {
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  // Go to admin after login if logged in
  if (pathname.startsWith("/login") && session) {
    if (session.user?.role === "SUPERADMIN") {
      return NextResponse.redirect(new URL("/admin", request.url))
    } else if (session.user?.role === "MASTER") {
      return NextResponse.redirect(new URL("/admin/master", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
}
