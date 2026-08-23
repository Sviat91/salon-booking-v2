import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { getTenantConfig } from '@/lib/tenant'
import { parseEnabledLocales } from '@/lib/localized-content'
import { isValidLanguage } from '@/lib/i18n-shared'
import { handleApiError } from '@/lib/api/error-handler'
import { ApiError } from '@/lib/api/error-responses'
import {
  REMINDER_TEMPLATE_TYPES,
  REMINDER_CHANNELS,
  MAX_BODY_LENGTH,
  DEFAULT_REMINDER_BODIES,
  validateTemplateBody,
  type ReminderType,
  type ReminderChannel,
} from '@/lib/notifications/templates'

export const runtime = 'nodejs'

const PutSchema = z.object({
  templates: z.array(
    z.object({
      type: z.string(),
      language: z.string(),
      channel: z.string(),
      body: z.string().max(4000),
    })
  ),
})

function isReminderType(value: string): value is ReminderType {
  return (REMINDER_TEMPLATE_TYPES as readonly string[]).includes(value)
}

function isReminderChannel(value: string): value is ReminderChannel {
  return (REMINDER_CHANNELS as readonly string[]).includes(value)
}

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const config = await getTenantConfig()
  const languages = parseEnabledLocales(config.enabledLocales)

  const rows = await prisma.notificationTemplate.findMany()
  const stored = new Map(rows.map((r) => [`${r.channel}:${r.type}:${r.language}`, r.body]))

  const result = []
  for (const channel of REMINDER_CHANNELS) {
    for (const type of REMINDER_TEMPLATE_TYPES) {
      for (const language of languages) {
        const body = stored.get(`${channel}:${type}:${language}`)
        result.push({
          type,
          language,
          channel,
          body: body ?? DEFAULT_REMINDER_BODIES[channel][type][language],
          isDefault: body === undefined,
        })
      }
    }
  }

  return NextResponse.json({ templates: result })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const raw = await req.json()
    const { templates } = PutSchema.parse(raw)

    for (const entry of templates) {
      if (!isReminderType(entry.type)) {
        throw new ApiError('VALIDATION_ERROR', `Invalid template type: ${entry.type}`, 400)
      }
      if (!isValidLanguage(entry.language)) {
        throw new ApiError('VALIDATION_ERROR', `Invalid language: ${entry.language}`, 400)
      }
      if (!isReminderChannel(entry.channel)) {
        throw new ApiError('VALIDATION_ERROR', `Invalid channel: ${entry.channel}`, 400)
      }
      if (entry.body.length > MAX_BODY_LENGTH[entry.channel]) {
        throw new ApiError('VALIDATION_ERROR', `Body too long for channel ${entry.channel}`, 400)
      }
      const validation = validateTemplateBody(entry.body)
      if (!validation.ok) {
        throw new ApiError(
          'TEMPLATE_UNKNOWN_PLACEHOLDER',
          `Unknown placeholder(s): ${validation.unknown.join(', ')}`,
          400,
          { unknown: validation.unknown }
        )
      }
    }

    for (const entry of templates) {
      const body = entry.body.trim()
      if (!body) {
        await prisma.notificationTemplate.deleteMany({
          where: { type: entry.type, language: entry.language, channel: entry.channel },
        })
      } else {
        await prisma.notificationTemplate.upsert({
          where: {
            type_language_channel: {
              type: entry.type,
              language: entry.language,
              channel: entry.channel,
            },
          },
          create: { type: entry.type, language: entry.language, channel: entry.channel, body },
          update: { body },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, { module: 'api.admin.reminder-templates' })
  }
}
