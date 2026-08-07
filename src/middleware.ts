import NextAuth from "next-auth"
import authConfig from "./auth.config"

// Initialize NextAuth strictly with the Edge-compatible config
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const pathname = nextUrl.pathname
  const role = req.auth?.user?.role

  // Protect /admin routes
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      return Response.redirect(new URL("/auth/login", nextUrl))
    }

    // SUPERADMIN-only routes
    const superadminOnly = ["/admin/admins", "/admin/db-browser"]
    if (superadminOnly.some(p => pathname.startsWith(p))) {
      if (role !== "SUPERADMIN") {
        return Response.redirect(new URL("/admin", nextUrl))
      }
    }

    // Master wants to access the admin/superadmin area — anything under
    // /admin that isn't their own /admin/master/* space. Previously this
    // only checked `pathname === "/admin"` (the exact dashboard root), so
    // navigating straight to an admin-only subroute like /admin/masters or
    // /admin/services fell through with no redirect at all: the page
    // rendered (no auth check in those Server Components — mutations are
    // separately guarded server-side, but the page itself was fully
    // readable) even though a master should never see it (2026-08-07 fix).
    if (role === "MASTER" && !pathname.startsWith("/admin/master")) {
      return Response.redirect(new URL("/admin/master", nextUrl))
    }

    // Client trying to access admin
    if (role === "CLIENT") {
      return Response.redirect(new URL("/", nextUrl))
    }
  }

  // Protect /profile routes — must be logged in
  if (pathname.startsWith("/profile")) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/auth/login", nextUrl)
      loginUrl.searchParams.set("callbackUrl", pathname)
      return Response.redirect(loginUrl)
    }
  }

  // Redirect logged-in users away from login page
  if (pathname.startsWith("/auth/login") && isLoggedIn) {
    // Respect callbackUrl if provided
    const callbackUrl = nextUrl.searchParams.get("callbackUrl")
    if (callbackUrl) {
      return Response.redirect(new URL(callbackUrl, nextUrl))
    }

    if (role === "SUPERADMIN" || role === "ADMIN") {
      return Response.redirect(new URL("/admin", nextUrl))
    } else if (role === "MASTER") {
      return Response.redirect(new URL("/admin/master", nextUrl))
    } else if (role === "CLIENT") {
      return Response.redirect(new URL("/profile", nextUrl))
    }

    // Fallback if role is unfamiliar
    return Response.redirect(new URL("/", nextUrl))
  }
})

export const config = {
  matcher: ["/admin/:path*", "/auth/login", "/profile/:path*"],
}
