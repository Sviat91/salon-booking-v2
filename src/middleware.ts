import NextAuth from "next-auth"
import authConfig from "./auth.config"

// Initialize NextAuth strictly with the Edge-compatible config
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const pathname = nextUrl.pathname

  // Protect /admin routes
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      return Response.redirect(new URL("/auth/login", nextUrl))
    }

    const role = req.auth?.user?.role

    // Master wants to access superadmin area (/admin but not /admin/master)
    if (role === "MASTER" && pathname === "/admin") {
      return Response.redirect(new URL("/admin/master", nextUrl))
    }

    // Client trying to access admin
    if (role === "CLIENT") {
      return Response.redirect(new URL("/", nextUrl))
    }
  }

  // Go to admin after login if logged in
  if (pathname.startsWith("/auth/login") && isLoggedIn) {
    if (req.auth?.user?.role === "SUPERADMIN") {
      return Response.redirect(new URL("/admin", nextUrl))
    } else if (req.auth?.user?.role === "MASTER") {
      return Response.redirect(new URL("/admin/master", nextUrl))
    }
  }
})

export const config = {
  matcher: ["/admin/:path*", "/auth/login"],
}
