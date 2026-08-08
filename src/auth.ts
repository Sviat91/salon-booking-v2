import NextAuth, { CredentialsSignin } from "next-auth"
import authConfig from "./auth.config"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@/lib/prisma"
import type { Adapter } from "next-auth/adapters"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { getRequestIp } from "@/lib/consent-service"
import { checkLoginGuards } from "@/lib/auth-guards"

import type { NextAuthConfig } from "next-auth"

class RateLimitedError extends CredentialsSignin {
  code = "rate_limited"
}

export const coreAuthOptions: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: { strategy: "jwt" },
  callbacks: authConfig.callbacks,
  pages: authConfig.pages,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        turnstileToken: { label: "Turnstile", type: "hidden" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const ip = getRequestIp(request)
        const normalizedEmail = (credentials.email as string).trim().toLowerCase()
        const guard = await checkLoginGuards({ ip, email: normalizedEmail, turnstileToken: credentials.turnstileToken })
        if (!guard.ok) {
          console.warn("[auth] login blocked:", guard.reason, ip)
          if (guard.reason === 'RATE_LIMITED') {
            throw new RateLimitedError()
          }
          return null
        }

        try {
          // Case-insensitive lookup via SQL LOWER(), not just a lowercased
          // input (2026-08-07 fix): registration (`/api/auth/register`)
          // stores `email.trim().toLowerCase()`, but this lookup previously
          // matched the raw credential exactly — any casing difference
          // between how the address was typed at registration vs. login
          // (browser autocapitalize, autofill, copy-paste) made the account
          // permanently unfindable here, which read as "wrong password" and
          // was not fixed by a password reset (the email lookup, not the
          // password, was the actual mismatch). Comparing case-insensitively
          // at the DB level (rather than just lowercasing the login input)
          // also matters because master/admin accounts created via
          // `admin/masters/actions.ts`'s `createMaster` or
          // `scripts/create-admin.ts` are NOT normalized to lowercase on
          // creation — a plain `.toLowerCase()` on only the login side would
          // silently break login for any such account whose stored email
          // happens to have uppercase characters, even though it worked
          // before this fix. Prisma's `mode: 'insensitive'` isn't available
          // on the SQLite/libSQL connector, hence the raw `LOWER()` query.
          const matches = await prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM User WHERE LOWER(email) = ${normalizedEmail} LIMIT 1
          `
          const user = matches[0]
            ? await prisma.user.findUnique({ where: { id: matches[0].id } })
            : null

          if (!user || !user.password) {
            return null
          }

          const passwordsMatch = await bcrypt.compare(
            credentials.password as string,
            user.password
          )

          if (passwordsMatch) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              phone: user.phone,
            }
          }
        } catch (error) {
          console.error("Authorize error:", error)
        }

        return null
      },
    }),
  ],
}

export const { handlers, signIn, signOut, auth } = NextAuth(coreAuthOptions)
