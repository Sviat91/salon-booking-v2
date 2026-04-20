# 📧 Email-инфраструктура + Восстановление пароля — План реализации

> **Цель**: Добавить email-инфраструктуру (SMTP через nodemailer, настройки в TenantConfig/Admin Panel) и реализовать flow восстановления пароля.
>
> **Примечание**: Email-инфраструктура проектируется как **общий транспорт**. После завершения этого плана она будет переиспользована для:
> - Подтверждение записи (booking confirmation email)
> - Напоминания о записи (за 24ч / 1ч)
> - Уведомления мастерам о новых записях
> - Любые другие email-уведомления в будущем

---

## 📖 Контекст: что уже есть

| Компонент | Статус | Путь |
|-----------|--------|------|
| Prisma + SQLite | ✅ | `prisma/schema.prisma` |
| TenantConfig (модель) | ✅ | `prisma/schema.prisma:171-211` |
| NextAuth (Credentials) | ✅ | `src/auth.ts`, `src/auth.config.ts` |
| Middleware (защита /admin, /profile) | ✅ | `src/middleware.ts` |
| LoginForm | ✅ | `src/components/auth/LoginForm.tsx` |
| Login page | ✅ | `src/app/auth/login/page.tsx` |
| Register page | ✅ | `src/app/auth/register/page.tsx` |
| Zod API schemas | ✅ | `src/lib/validation/api-schemas.ts` |
| bcryptjs | ✅ | `package.json` |
| Upstash Redis + rate limiting | ✅ | `src/lib/cache.ts` |
| i18n (en, pl, uk) | ✅ | `src/locales/*.json` |
| UI Components (Button, Input, Label, Card) | ✅ | `src/components/ui/*` |
| Admin Panel | ✅ | `src/app/admin/` |
| Email-инфраструктура | ❌ **Нет** | — |

---

## 🏗 Архитектура решения

### SMTP-настройки

Хранятся в `TenantConfig` (уже есть). Каждый салон вводит свои SMTP-данные один раз в Admin Panel → «Email Settings». Поддерживается любой SMTP-провайдер (Gmail, Outlook, Hostinger, OVH и т.д.).

```
TenantConfig (расширение)
  + smtpHost      String?    // "smtp.gmail.com"
  + smtpPort      Int?       // 587
  + smtpUser      String?    // "salon@gmail.com"
  + smtpPass      String?    // App Password или обычный
  + smtpFrom      String?    // "Salon Beauty <salon@gmail.com>"
  + smtpSecure    Boolean    // true для порта 465, false для 587 (STARTTLS)
```

### Flow восстановления пароля

```
1. Клиент нажимает "Forgot password?" на /auth/login
      ↓
2. /auth/forgot-password — вводит email
      ↓
3. POST /api/auth/forgot-password
      ├── Найти User по email (isGuest=false, password!=null)
      ├── Создать PasswordResetToken (token = crypto.randomUUID(), expires = 1ч)
      └── Отправить письмо через nodemailer (SMTP из TenantConfig)
      ↓
4. Клик по ссылке → /auth/reset-password?token=<uuid>
      ↓
5. POST /api/auth/reset-password
      ├── Найти токен → проверить не истёк
      ├── bcrypt.hash(newPassword) → обновить User.password
      └── Удалить token (одноразовый)
      ↓
6. Redirect → /auth/login (с сообщением "Пароль обновлён")
```

### Безопасность
- Токен: `crypto.randomUUID()` — криптографически безопасный, без внешних зависимостей
- TTL: 1 час
- Одноразовый — удаляется после использования
- API всегда 200 OK (даже если email не найден) — защита от email enumeration
- Rate limit: 3 запроса / 15 мин per IP (через существующий `rateLimit()` из `cache.ts`)

---

## 📋 Пошаговый план реализации

### Фаза 1: Зависимости и Schema

#### Шаг 1.1: Установить nodemailer
- [x] `npm install nodemailer`
- [x] `npm install -D @types/nodemailer`

**Почему nodemailer**: Единственная зависимость, работает с любым SMTP, 0 vendor lock-in. Идеально для white-label SaaS.

#### Шаг 1.2: Обновить Prisma Schema — SMTP-поля в TenantConfig

**Файл**: `prisma/schema.prisma` → модель `TenantConfig` [MODIFY]

Добавить поля **после** `logoLayer`:
```prisma
  // Email / SMTP settings
  smtpHost      String?
  smtpPort      Int?       @default(587)
  smtpUser      String?
  smtpPass      String?
  smtpFrom      String?    // "Salon Name <email@example.com>"
  smtpSecure    Boolean    @default(false) // true for port 465 (SSL), false for 587 (STARTTLS)
```

#### Шаг 1.3: Обновить Prisma Schema — модель PasswordResetToken

**Файл**: `prisma/schema.prisma` [ADD MODEL]

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
}
```

И добавить в модель `User` relation:
```prisma
  passwordResetTokens  PasswordResetToken[]
```

#### Шаг 1.4: Применить миграцию
- [x] `npx prisma db push` (для SQLite dev workflow без миграций)
- [x] `npx prisma generate`

---

### Фаза 2: Email Service (общий транспорт)

#### Шаг 2.1: Создать `src/lib/email.ts`

**Файл**: `src/lib/email.ts` [✅ DONE]

Экспортирует:
- `getSmtpConfig()` — читает SMTP-настройки из TenantConfig в БД
- `sendEmail({ to, subject, html })` — отправляет письмо через nodemailer
- `sendPasswordResetEmail(to, resetUrl, brandName)` — конкретный шаблон для reset

```ts
import nodemailer from 'nodemailer'
import prisma from '@/lib/prisma'

// Загружает SMTP настройки из TenantConfig (кеширует на 5 мин)
export async function getSmtpConfig() {
  const config = await prisma.tenantConfig.findFirst()
  if (!config?.smtpHost || !config?.smtpUser || !config?.smtpPass) {
    return null // SMTP не настроен
  }
  return {
    host: config.smtpHost,
    port: config.smtpPort || 587,
    secure: config.smtpSecure,
    auth: { user: config.smtpUser, pass: config.smtpPass },
    from: config.smtpFrom || config.smtpUser,
    brandName: config.brandName,
  }
}

// Общая функция отправки (переиспользуется для всех типов писем)
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const smtp = await getSmtpConfig()
  if (!smtp) { throw new Error('SMTP not configured') }
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth,
  })
  await transporter.sendMail({ from: smtp.from, to, subject, html })
}
```

**Важно**: `sendEmail` — общая функция. В будущем для booking confirmation, reminders и т.д. добавляются ТОЛЬКО новые шаблонные функции (напр. `sendBookingConfirmationEmail()`), а `sendEmail()` переиспользуется.

#### Шаг 2.2: Создать email-шаблон для password reset

Внутри `src/lib/email.ts` (или отдельный файл `src/lib/email-templates.ts` если шаблонов будет много):

```ts
export function buildPasswordResetHtml(resetUrl: string, brandName: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #333;">${brandName}</h2>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <a href="${resetUrl}" 
         style="display: inline-block; padding: 12px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 8px; margin: 16px 0;">
        Reset Password
      </a>
      <p style="color: #888; font-size: 13px;">This link will expire in 1 hour.</p>
      <p style="color: #888; font-size: 13px;">If you didn't request this, ignore this email.</p>
    </div>
  `
}
```

---

### Фаза 3: API Routes — forgot/reset password

#### Шаг 3.1: Zod-схемы для новых API

**Файл**: `src/lib/validation/api-schemas.ts` [MODIFY]

Добавить в конец:
```ts
// ============================================
// Password Reset Schemas
// ============================================
export const forgotPasswordApiSchema = z.object({
  email: z.string().email('Invalid email format'),
})
export type ForgotPasswordApiInput = z.infer<typeof forgotPasswordApiSchema>

export const resetPasswordApiSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
})
export type ResetPasswordApiInput = z.infer<typeof resetPasswordApiSchema>
```

#### Шаг 3.2: `POST /api/auth/forgot-password`

**Файл**: `src/app/api/auth/forgot-password/route.ts` [NEW]

Логика:
1. Zod-валидация body `{ email }`
2. Rate limit: `rateLimit(\`forgot-pw:\${ip}\`, 3, 900)` — 3 попытки / 15 мин
3. **Всегда** возвращает `200 { message: "If registered, you'll receive an email" }`
4. Внутри (тихо, не блокируя response):
   - `findFirst({ email, isGuest: false, password: { not: null } })`
   - Если нашли → удалить старые токены этого user → создать новый `PasswordResetToken`
   - Отправить письмо через `sendEmail()`
5. Если SMTP не настроен → в console.error, но response `200` (не выдаём инфу)

#### Шаг 3.3: `POST /api/auth/reset-password`

**Файл**: `src/app/api/auth/reset-password/route.ts` [NEW]

Логика:
1. Zod-валидация `{ token, newPassword }`
2. `findUnique({ token })` + проверить `expiresAt > now()`
3. `bcrypt.hash(newPassword, 10)` → `prisma.user.update({ password: hash })`
4. Удалить ВСЕ токены этого user (на случай нескольких запросов)
5. Response `200 { success: true }`
6. Невалидный/просроченный токен → `400 { error: "invalid_token" }`

---

### Фаза 4: Frontend — Страницы

#### Шаг 4.1: Страница `/auth/forgot-password`

**Файлы**:
- `src/app/auth/forgot-password/page.tsx` [NEW] — server component (metadata)
- `src/components/auth/ForgotPasswordForm.tsx` [NEW] — клиентский компонент

**UI** (повторяет стиль Register/Login pages):
```
┌────────────────────────────────────┐
│       Somique beauty               │
│                                    │
│    Reset your password             │
│    Enter your email to receive     │
│    a password reset link.          │
│                                    │
│    ┌──────────────────────────┐    │
│    │ Email                    │    │
│    └──────────────────────────┘    │  
│    [ Send reset link ]             │
│                                    │
│    ← Back to login                 │
└────────────────────────────────────┘
```

После отправки:
```
┌────────────────────────────────────┐
│    ✉️ Check your email             │
│                                    │
│    If your email is registered,    │
│    you'll receive a reset link     │
│    shortly.                        │
│                                    │
│    ← Back to login                 │
└────────────────────────────────────┘
```

Компонент:
- `useState` для `email`, `isLoading`, `isSent`, `error`
- `fetch('/api/auth/forgot-password', { method: 'POST', body: { email } })`
- i18n через `useTranslation()`

#### Шаг 4.2: Страница `/auth/reset-password`

**Файлы**:
- `src/app/auth/reset-password/page.tsx` [NEW] — server component
- `src/components/auth/ResetPasswordForm.tsx` [NEW] — клиентский компонент

**UI**:
```
┌────────────────────────────────────┐
│       Somique beauty               │
│                                    │
│    Create new password             │
│                                    │
│    ┌──────────────────────────┐    │
│    │ New password             │    │
│    └──────────────────────────┘    │
│    ┌──────────────────────────┐    │
│    │ Confirm password         │    │
│    └──────────────────────────┘    │
│    [ Set new password ]            │
│                                    │
│    ← Back to login                 │
└────────────────────────────────────┘
```

Компонент:
- Читает `?token=` из `useSearchParams()`
- `useState` для `password`, `confirmPassword`, `isLoading`, `error`, `isSuccess`
- Валидация: min 6 символов, пароли совпадают (клиентская)
- `fetch('/api/auth/reset-password', { method: 'POST', body: { token, newPassword } })`
- При ошибке `invalid_token` → показать "Link expired" + кнопка "Request new link"
- При успехе → redirect на `/auth/login?reset=success`

---

### Фаза 5: Обновить LoginForm

#### Шаг 5.1: Ссылка "Forgot password?"

**Файл**: `src/components/auth/LoginForm.tsx` [MODIFY]

После поля Password, перед кнопкой Submit, добавить:
```tsx
<div className="flex justify-end">
  <a 
    href="/auth/forgot-password" 
    className="text-xs text-muted-foreground hover:text-primary transition-colors"
  >
    {t('auth.forgotPassword', 'Forgot password?')}
  </a>
</div>
```

#### Шаг 5.2: Success-сообщение после сброса пароля

**Файл**: `src/app/auth/login/page.tsx` [MODIFY]

Если URL содержит `?reset=success` → показать зелёное уведомление "Password updated successfully. You can now sign in."

---

### Фаза 6: i18n

#### Шаг 6.1: Добавить ключи во все 3 локали

**Файлы**: `src/locales/en.json`, `pl.json`, `uk.json` [MODIFY]

Добавить секцию `"auth"`:
```json
"auth": {
  "forgotPassword": "Forgot password?",
  "forgotPasswordTitle": "Reset your password",
  "forgotPasswordDesc": "Enter your email address and we'll send you a link to reset your password.",
  "forgotPasswordSubmit": "Send reset link",
  "forgotPasswordSending": "Sending...",
  "forgotPasswordSentTitle": "Check your email",
  "forgotPasswordSentDesc": "If this email is registered, you'll receive a password reset link shortly.",
  "resetPasswordTitle": "Create new password",
  "resetPasswordNew": "New password",
  "resetPasswordConfirm": "Confirm password",
  "resetPasswordSubmit": "Set new password",
  "resetPasswordSuccess": "Password updated successfully!",
  "resetPasswordSuccessDesc": "You can now sign in with your new password.",
  "resetTokenInvalid": "This link has expired or is invalid.",
  "resetTokenInvalidDesc": "Please request a new password reset link.",
  "resetPasswordMismatch": "Passwords do not match.",
  "resetPasswordTooShort": "Password must be at least 6 characters.",
  "requestNewLink": "Request new link",
  "backToLogin": "Back to sign in"
}
```

---

### Фаза 7: Admin Panel — Email Settings (опционально, позже)

> **ПРИМЕЧАНИЕ**: Эту фазу можно сделать после основного flow. На время разработки SMTP можно настроить через Prisma Studio (`npx prisma studio` → TenantConfig → вписать smtpHost и т.д.).

#### Шаг 7.1: API для SMTP-настроек
- [ ] `GET /api/admin/email-settings` — возвращает текущие SMTP-поля (без пароля)
- [ ] `PATCH /api/admin/email-settings` — обновляет SMTP-поля
- [ ] `POST /api/admin/email-settings/test` — отправляет тестовое письмо admin'у

#### Шаг 7.2: UI — страница Admin → Email Settings
- [ ] `/admin/settings/email/page.tsx`
- [ ] Форма: Host, Port, User, Password, From Name, Secure toggle
- [ ] Кнопка "Send test email"
- [ ] Toast об успехе / ошибке

---

## 📁 Итоговый список файлов

| Файл | Действие | Описание |
|------|----------|----------|
| `package.json` | MODIFY | + nodemailer, @types/nodemailer |
| `prisma/schema.prisma` | MODIFY | + SMTP поля в TenantConfig, + PasswordResetToken модель, + relation в User |
| `src/lib/email.ts` | NEW | Общий email-транспорт (nodemailer + TenantConfig) |
| `src/lib/validation/api-schemas.ts` | MODIFY | + forgotPasswordApiSchema, resetPasswordApiSchema |
| `src/app/api/auth/forgot-password/route.ts` | NEW | POST — создать токен, отправить email |
| `src/app/api/auth/reset-password/route.ts` | NEW | POST — валидация токена, обновление пароля |
| `src/app/auth/forgot-password/page.tsx` | NEW | Страница "Forgot Password" |
| `src/components/auth/ForgotPasswordForm.tsx` | NEW | Форма ввода email |
| `src/app/auth/reset-password/page.tsx` | NEW | Страница "Reset Password" |
| `src/components/auth/ResetPasswordForm.tsx` | NEW | Форма нового пароля |
| `src/components/auth/LoginForm.tsx` | MODIFY | + ссылка "Forgot password?" |
| `src/app/auth/login/page.tsx` | MODIFY | + success banner после reset |
| `src/locales/en.json` | MODIFY | + секция auth |
| `src/locales/pl.json` | MODIFY | + секция auth (PL) |
| `src/locales/uk.json` | MODIFY | + секция auth (UK) |

---

## ✅ Проверка (Verification Plan)

### Build
- [ ] `npx prisma generate` — без ошибок
- [ ] `npm run build` — TypeScript build clean

### Manual Testing
1. [ ] Незарегистрированный email → форма показывает "Check your email" (без утечки инфо)
2. [ ] Зарегистрированный email → письмо приходит на почту
3. [ ] Клик по ссылке → форма нового пароля открывается
4. [ ] Ввод нового пароля → пароль обновлён → redirect на login
5. [ ] Вход со старым паролем → ошибка
6. [ ] Вход с новым паролем → success
7. [ ] Повторное использование ссылки → "Link expired"
8. [ ] Ссылка старше 1 часа → "Link expired"
9. [ ] 4+ запроса за 15 мин → 429 Too Many Requests
10. [ ] SMTP не настроен → console.error, но UI не ломается
11. [ ] Переключение языков (EN/PL/UK) → тексты корректны
