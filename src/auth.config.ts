import type { NextAuthConfig } from "next-auth"

// IMPORTANT: This file is used in middleware (Edge runtime).
// It must NOT import prisma, bcryptjs, or any Node.js-only modules.
// The Credentials provider with DB access lives in auth.ts (Node.js runtime only).
export default {
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string
        session.user.id = token.id as string
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/login",
  },
} satisfies NextAuthConfig
