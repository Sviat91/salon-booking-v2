import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@/lib/prisma"
import type { Adapter } from "next-auth/adapters"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

import type { NextAuthConfig } from "next-auth"

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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const user = await prisma.user.findFirst({
            where: { email: credentials.email as string },
          })

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
