import { NextRequest } from "next/server"
import NextAuth from "next-auth"
import { coreAuthOptions } from "@/auth"
import prisma from "@/lib/prisma"
import { decrypt } from "@/lib/encryption"
import Google from "next-auth/providers/google"
import Apple from "next-auth/providers/apple"
import Credentials from "next-auth/providers/credentials"
import crypto from "crypto"

async function getDynamicConfig() {
  const config = await prisma.tenantConfig.findFirst()
  // clone array to avoid mutating global config
  const providers = [...(coreAuthOptions.providers || [])]

  if (config) {
    // Google Provider
    if (config.googleClientId && config.googleClientSecret) {
      const secret = decrypt(config.googleClientSecret)
      if (secret) {
        providers.push(Google({
          clientId: config.googleClientId,
          clientSecret: secret,
          allowDangerousEmailAccountLinking: true
        }))
      }
    }
    
    // Apple Provider
    if (config.appleClientId && config.appleTeamId && config.appleKeyId && config.applePrivateKey) {
      const privateKey = decrypt(config.applePrivateKey)
      if (privateKey) {
        providers.push(Apple({
          clientId: config.appleClientId,
          clientSecret: {
            teamId: config.appleTeamId,
            privateKey: privateKey,
            keyId: config.appleKeyId,
          },
          allowDangerousEmailAccountLinking: true
        }))
      }
    }
    
    // Telegram Provider - Auth.js expects standard OAuth out of the box, 
    // so we build it as a custom Credentials provider that verifies the HMAC payload
    if (config.telegramBotToken && config.telegramBotUsername) {
      const botToken = decrypt(config.telegramBotToken)
      if (botToken) {
        providers.push(Credentials({
          id: "telegram",
          name: "Telegram",
          credentials: {
            id: { type: "text" },
            first_name: { type: "text" },
            last_name: { type: "text" },
            username: { type: "text" },
            photo_url: { type: "text" },
            auth_date: { type: "text" },
            hash: { type: "text" },
          },
          async authorize(credentials) {
            if (!credentials?.id || !credentials?.hash) return null

            // Telegram verification algorithm
            const dataToCheck: string[] = []
            for (const key in credentials) {
              if (key !== "hash" && credentials[key]) {
                dataToCheck.push(`${key}=${credentials[key]}`)
              }
            }
            dataToCheck.sort()
            const dataCheckString = dataToCheck.join('\n')
            const secretKey = crypto.createHash('sha256').update(botToken).digest()
            const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
            
            if (hash !== credentials.hash) {
              console.error("[telegram] Invalid hash signature")
              return null 
            }
            
            // Validity check (prevent old auth requests)
            const authDate = parseInt(credentials.auth_date as string, 10)
            const now = Math.floor(Date.now() / 1000)
            if (now - authDate > 86400) { // older than 24 hours
               console.error("[telegram] Auth date is too old")
               return null
            }
            
            // Data is valid. Link or create user
            const telegramId = credentials.id as string
            let linkedAccount = await prisma.account.findFirst({
              where: { provider: 'telegram', providerAccountId: telegramId },
              include: { user: true }
            })
            
            if (linkedAccount && linkedAccount.user) {
              return linkedAccount.user
            }

            // Create new generic user for Telegram auth if not found
            // Since email might not be available from telegram widget natively, we leave it null or map username
            const newUser = await prisma.user.create({
              data: {
                name: [credentials.first_name, credentials.last_name].filter(Boolean).join(" "),
                image: credentials.photo_url as string || null,
                role: "CLIENT",
                isGuest: false,
                accounts: {
                  create: {
                    type: "oauth",
                    provider: "telegram",
                    providerAccountId: telegramId,
                  }
                }
              }
            })
            return newUser
          }
        }))
      }
    }
  }

  return { ...coreAuthOptions, providers }
}

export const GET = async (req: NextRequest) => {
  const dynamicConfig = await getDynamicConfig()
  return NextAuth(dynamicConfig).handlers.GET(req)
}

export const POST = async (req: NextRequest) => {
  const dynamicConfig = await getDynamicConfig()
  return NextAuth(dynamicConfig).handlers.POST(req)
}
