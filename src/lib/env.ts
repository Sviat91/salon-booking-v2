import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  N8N_WEBHOOK_URL: z.string().url().optional(),
  N8N_WEBHOOK_MASTER_CALL: z.string().url().optional(),
  N8N_SECRET_TOKEN: z.string().optional(),
  N8N_SECRET_HEADER: z.string().default('x-secret-token'),
})

const env = EnvSchema.parse(process.env)

export const config = {
  ...env,
  TURNSTILE_SECRET_EFFECTIVE: env.TURNSTILE_SECRET || env.TURNSTILE_SECRET_KEY,
}

export type AppConfig = typeof config
