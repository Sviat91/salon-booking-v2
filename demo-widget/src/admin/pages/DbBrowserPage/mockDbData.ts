// Mock row data for the 11 real Prisma tables the DB Browser exposes.
// Field names/order are copied 1:1 from `prisma/schema.prisma` (verified at
// plan time) — this file has no logic, just data, so it stays readable
// despite the volume (tenantConfig alone has ~80 scalar fields).
//
// The 6 fields the real `/api/admin/db-browser/[table]` route masks
// (`user.password`, `user.passwordEncrypted`, `tenantConfig.smtpPass`,
// `tenantConfig.googleClientSecret`, `tenantConfig.applePrivateKey`,
// `tenantConfig.telegramBotToken`) are hardcoded to the literal string
// "[REDACTED]" directly below wherever a real row would have a secret set,
// exactly matching production's masked output — no runtime masking function
// needed since this is static mock data, not a live query.

export const TABLES = [
  'user',
  'masterProfile',
  'service',
  'masterService',
  'consentRecord',
  'schedule',
  'appointment',
  'dateOverride',
  'tenantConfig',
  'passwordResetToken',
  'account',
] as const

export type TableName = (typeof TABLES)[number]
export type DbRow = Record<string, unknown>

const d = (iso: string) => new Date(iso)

// Reuses the same invented cast established elsewhere in this demo:
// masters Marek Zawadzki / Anna Nowak (data.ts), clients Kasia Wiśniewska /
// Tomasz Nowicki (mockAdminData.ts, DatabasePage/ClientsTab.tsx), admins
// Super Admin / Ewa Kowalczyk (AdminsPage.tsx).
const userRows: DbRow[] = [
  { id: 'u1', name: 'Super Admin', email: 'superadmin@loomandblade.pl', emailVerified: d('2025-01-05T09:00:00Z'), phone: null, password: '[REDACTED]', passwordEncrypted: '[REDACTED]', image: null, role: 'SUPERADMIN', adminPermissions: null, isGuest: false, telegramChatId: null, createdAt: d('2025-01-05T09:00:00Z'), updatedAt: d('2026-07-20T11:00:00Z') },
  { id: 'u2', name: 'Ewa Kowalczyk', email: 'ewa.kowalczyk@loomandblade.pl', emailVerified: d('2025-02-10T10:00:00Z'), phone: '+48 600 111 222', password: '[REDACTED]', passwordEncrypted: '[REDACTED]', image: null, role: 'ADMIN', adminPermissions: '{"clients":{"view":true,"edit":true,"delete":false},"gdpr":{"view":true,"withdraw":false,"erase":false}}', isGuest: false, telegramChatId: null, createdAt: d('2025-02-10T10:00:00Z'), updatedAt: d('2026-06-15T08:30:00Z') },
  { id: 'u3', name: 'Marek Zawadzki', email: 'marek.zawadzki@loomandblade.pl', emailVerified: d('2025-01-08T09:00:00Z'), phone: '+48 601 555 111', password: '[REDACTED]', passwordEncrypted: '[REDACTED]', image: null, role: 'MASTER', adminPermissions: null, isGuest: false, telegramChatId: '987654321', createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2026-08-01T12:00:00Z') },
  { id: 'u4', name: 'Anna Nowak', email: 'anna.nowak@loomandblade.pl', emailVerified: d('2025-01-08T09:00:00Z'), phone: '+48 601 555 222', password: '[REDACTED]', passwordEncrypted: '[REDACTED]', image: null, role: 'MASTER', adminPermissions: null, isGuest: false, telegramChatId: null, createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2026-08-01T12:00:00Z') },
  { id: 'u5', name: 'Kasia Wiśniewska', email: 'kasia.wisniewska@gmail.com', emailVerified: d('2025-03-12T14:20:00Z'), phone: '+48 601 111 222', password: '[REDACTED]', passwordEncrypted: '[REDACTED]', image: null, role: 'CLIENT', adminPermissions: null, isGuest: false, telegramChatId: null, createdAt: d('2025-03-12T14:20:00Z'), updatedAt: d('2026-08-10T09:15:00Z') },
  { id: 'u6', name: 'Tomasz Nowicki', email: 'tomasz.nowicki@gmail.com', emailVerified: null, phone: '+48 601 234 567', password: null, passwordEncrypted: null, image: null, role: 'CLIENT', adminPermissions: null, isGuest: true, telegramChatId: null, createdAt: d('2025-05-02T16:40:00Z'), updatedAt: d('2025-05-02T16:40:00Z') },
]

const masterProfileRows: DbRow[] = [
  { id: 'mp1', userId: 'u3', avatarUrl: '/marek.png', bio_pl: null, bio_en: 'Over 12 years behind the chair, specializing in precision fades and classic wet shaves. Trained in Warsaw and London.', bio_uk: null, specialties: '["fades","wet shaves","beard grooming"]', showOnHomepage: true, color: '#166534', footerBlock: null, createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2026-08-01T12:00:00Z') },
  { id: 'mp2', userId: 'u4', avatarUrl: '/anna.png', bio_pl: null, bio_en: 'Colorist and stylist with a decade of experience in balayage and precision cutting. Continuously trained on the latest European color techniques.', bio_uk: null, specialties: '["balayage","color","precision cutting"]', showOnHomepage: true, color: '#B35C37', footerBlock: null, createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2026-08-01T12:00:00Z') },
]

const serviceRows: DbRow[] = [
  { id: 'sv1', name_pl: null, name_en: 'Combo: Haircut & Beard', name_uk: null, duration: 75, price: 153, masterId: 'u3', createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2026-05-01T10:00:00Z') },
  { id: 'sv2', name_pl: null, name_en: "Classic Men's Haircut", name_uk: null, duration: 45, price: 99, masterId: 'u3', createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2026-05-01T10:00:00Z') },
  { id: 'sv3', name_pl: null, name_en: 'Royal Shave with Hot Towel', name_uk: null, duration: 45, price: 90, masterId: 'u3', createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2026-05-01T10:00:00Z') },
  { id: 'sv4', name_pl: null, name_en: 'Premium Haircut & Style Consultation', name_uk: null, duration: 60, price: 162, masterId: 'u3', createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2026-05-01T10:00:00Z') },
  { id: 'sv5', name_pl: null, name_en: 'Hair Wash & Blow Dry Styling', name_uk: null, duration: 45, price: 81, masterId: 'u3', createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2026-05-01T10:00:00Z') },
  { id: 'sv6', name_pl: null, name_en: 'Balayage / AirTouch Coloring', name_uk: null, duration: 210, price: 495, masterId: 'u4', createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2026-05-01T10:00:00Z') },
]

// Anna's per-master price overrides on services owned by Marek's catalog
// entry — mirrors the "Special Prices" badges shown in ServicesPage.tsx.
const masterServiceRows: DbRow[] = [
  { id: 'ms1', masterProfileId: 'mp2', serviceId: 'sv4', priceOverride: 144, createdAt: d('2025-02-01T09:00:00Z'), updatedAt: d('2025-02-01T09:00:00Z') },
  { id: 'ms2', masterProfileId: 'mp2', serviceId: 'sv5', priceOverride: null, createdAt: d('2025-02-01T09:00:00Z'), updatedAt: d('2025-02-01T09:00:00Z') },
  { id: 'ms3', masterProfileId: 'mp2', serviceId: 'sv2', priceOverride: 95, createdAt: d('2025-03-15T09:00:00Z'), updatedAt: d('2025-03-15T09:00:00Z') },
]

// Same 4 records shown in DatabasePage/GdprTab.tsx, expanded to the full
// ConsentRecord field list.
const consentRecordRows: DbRow[] = [
  { id: 'g1', userId: 'u5', phoneDigits: '48601111222', email: 'kasia.wisniewska@gmail.com', emailNormalized: 'kasia.wisniewska@gmail.com', fullName: 'Kasia Wiśniewska', normalizedName: 'kasia wisniewska', consentDate: d('2025-03-12T14:20:00Z'), ipHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a0', consentPrivacyV10: true, consentTermsV10: true, consentNotificationsV10: true, consentWithdrawnDate: null, withdrawalMethod: null, requestErasureDate: null, erasureDate: null, erasureMethod: null, createdAt: d('2025-03-12T14:20:00Z'), updatedAt: d('2025-03-12T14:20:00Z') },
  { id: 'g2', userId: 'u6', phoneDigits: '48601234567', email: 'tomasz.nowicki@gmail.com', emailNormalized: 'tomasz.nowicki@gmail.com', fullName: 'Tomasz Nowicki', normalizedName: 'tomasz nowicki', consentDate: d('2025-05-02T16:40:00Z'), ipHash: '3608bca1e44ea6c4d268eb6db02260269892c0b42b86bbf1e77a6fa16c3c9be', consentPrivacyV10: true, consentTermsV10: true, consentNotificationsV10: false, consentWithdrawnDate: d('2026-01-15T10:00:00Z'), withdrawalMethod: 'SELF_SERVICE', requestErasureDate: null, erasureDate: null, erasureMethod: null, createdAt: d('2025-05-02T16:40:00Z'), updatedAt: d('2026-01-15T10:00:00Z') },
  { id: 'g3', userId: 'u7', phoneDigits: '48512987654', email: 'piotr.zielinski@wp.pl', emailNormalized: 'piotr.zielinski@wp.pl', fullName: 'Piotr Zieliński', normalizedName: 'piotr zielinski', consentDate: d('2025-06-20T11:10:00Z'), ipHash: '2c624232cdd221771294dfbb310aca000a0df6ac8b66b696d90ef06f4c95ded', consentPrivacyV10: true, consentTermsV10: true, consentNotificationsV10: true, consentWithdrawnDate: null, withdrawalMethod: null, requestErasureDate: null, erasureDate: null, erasureMethod: null, createdAt: d('2025-06-20T11:10:00Z'), updatedAt: d('2025-06-20T11:10:00Z') },
  { id: 'g4', userId: 'u8', phoneDigits: '48698456123', email: null, emailNormalized: null, fullName: 'Agnieszka Dąbrowska', normalizedName: 'agnieszka dabrowska', consentDate: d('2025-07-08T13:00:00Z'), ipHash: '19a49d5b7bb3f0a3dc4b6b90f9d47e0d5f5f3c9d2f8c9c9c9b4a3d2e1f0a9b8c', consentPrivacyV10: true, consentTermsV10: true, consentNotificationsV10: true, consentWithdrawnDate: null, withdrawalMethod: null, requestErasureDate: d('2026-02-01T09:00:00Z'), erasureDate: d('2026-02-01T09:05:00Z'), erasureMethod: 'SELF_SERVICE', createdAt: d('2025-07-08T13:00:00Z'), updatedAt: d('2026-02-01T09:05:00Z') },
]

const scheduleRows: DbRow[] = [
  { id: 'sc1', masterId: 'u3', dayOfWeek: 1, isDayOff: false, intervals: '[{"start":"09:00","end":"18:00"}]', createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2025-01-08T09:00:00Z') },
  { id: 'sc2', masterId: 'u3', dayOfWeek: 2, isDayOff: false, intervals: '[{"start":"09:00","end":"18:00"}]', createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2025-01-08T09:00:00Z') },
  { id: 'sc3', masterId: 'u3', dayOfWeek: 0, isDayOff: true, intervals: null, createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2025-01-08T09:00:00Z') },
  { id: 'sc4', masterId: 'u4', dayOfWeek: 1, isDayOff: false, intervals: '[{"start":"10:00","end":"19:00"}]', createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2025-01-08T09:00:00Z') },
  { id: 'sc5', masterId: 'u4', dayOfWeek: 3, isDayOff: false, intervals: '[{"start":"10:00","end":"19:00"}]', createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2025-01-08T09:00:00Z') },
  { id: 'sc6', masterId: 'u4', dayOfWeek: 0, isDayOff: true, intervals: null, createdAt: d('2025-01-08T09:00:00Z'), updatedAt: d('2025-01-08T09:00:00Z') },
]

// 8 rows (> the page's mock pageSize of 5) so this table demonstrates real
// Prev/Next pagination — see DbBrowserPage/index.tsx.
const appointmentRows: DbRow[] = [
  { id: 'ap1', clientId: 'u5', masterId: 'u3', serviceId: 'sv2', date: d('2026-08-17T00:00:00Z'), startTime: '10:00', endTime: '10:45', status: 'CONFIRMED', notes: null, clientLanguage: 'en', discountId: null, originalPrice: null, finalPrice: 99, createdAt: d('2026-08-10T08:00:00Z'), updatedAt: d('2026-08-10T08:00:00Z') },
  { id: 'ap2', clientId: 'u6', masterId: 'u3', serviceId: 'sv1', date: d('2026-08-17T00:00:00Z'), startTime: '14:00', endTime: '15:15', status: 'CONFIRMED', notes: null, clientLanguage: 'en', discountId: 'd1', originalPrice: 170, finalPrice: 153, createdAt: d('2026-08-09T12:00:00Z'), updatedAt: d('2026-08-09T12:00:00Z') },
  { id: 'ap3', clientId: 'u9', masterId: 'u4', serviceId: 'sv6', date: d('2026-08-16T00:00:00Z'), startTime: '11:00', endTime: '13:00', status: 'CONFIRMED', notes: null, clientLanguage: 'pl', discountId: null, originalPrice: null, finalPrice: 495, createdAt: d('2026-08-05T09:30:00Z'), updatedAt: d('2026-08-05T09:30:00Z') },
  { id: 'ap4', clientId: 'u10', masterId: 'u3', serviceId: 'sv3', date: d('2026-08-19T00:00:00Z'), startTime: '15:00', endTime: '15:45', status: 'CONFIRMED', notes: 'Prefers unscented shaving cream.', clientLanguage: 'en', discountId: null, originalPrice: null, finalPrice: 90, createdAt: d('2026-08-04T17:00:00Z'), updatedAt: d('2026-08-04T17:00:00Z') },
  { id: 'ap5', clientId: 'u11', masterId: 'u4', serviceId: 'sv6', date: d('2026-08-15T00:00:00Z'), startTime: '12:00', endTime: '15:30', status: 'PENDING', notes: null, clientLanguage: 'pl', discountId: null, originalPrice: null, finalPrice: 495, createdAt: d('2026-08-03T10:00:00Z'), updatedAt: d('2026-08-03T10:00:00Z') },
  { id: 'ap6', clientId: 'u5', masterId: 'u3', serviceId: 'sv5', date: d('2026-08-10T00:00:00Z'), startTime: '09:00', endTime: '09:45', status: 'CONFIRMED', notes: null, clientLanguage: 'en', discountId: null, originalPrice: null, finalPrice: 81, createdAt: d('2026-08-01T08:00:00Z'), updatedAt: d('2026-08-01T08:00:00Z') },
  { id: 'ap7', clientId: 'u6', masterId: 'u4', serviceId: 'sv4', date: d('2026-08-05T00:00:00Z'), startTime: '16:00', endTime: '17:00', status: 'CANCELLED', notes: 'Client rescheduled.', clientLanguage: 'en', discountId: null, originalPrice: null, finalPrice: 144, createdAt: d('2026-07-28T14:00:00Z'), updatedAt: d('2026-08-04T09:00:00Z') },
  { id: 'ap8', clientId: 'u12', masterId: 'u3', serviceId: 'sv2', date: d('2026-07-29T00:00:00Z'), startTime: '11:00', endTime: '11:45', status: 'CONFIRMED', notes: null, clientLanguage: 'en', discountId: null, originalPrice: null, finalPrice: 99, createdAt: d('2026-07-20T11:00:00Z'), updatedAt: d('2026-07-20T11:00:00Z') },
]

const dateOverrideRows: DbRow[] = [
  { id: 'do1', masterId: 'u3', date: d('2026-12-25T00:00:00Z'), isDayOff: true, intervals: null, createdAt: d('2026-06-01T09:00:00Z'), updatedAt: d('2026-06-01T09:00:00Z') },
  { id: 'do2', masterId: 'u4', date: d('2026-12-24T00:00:00Z'), isDayOff: false, intervals: '[{"start":"09:00","end":"14:00"}]', createdAt: d('2026-06-01T09:00:00Z'), updatedAt: d('2026-06-01T09:00:00Z') },
  { id: 'do3', masterId: 'u3', date: d('2027-01-01T00:00:00Z'), isDayOff: true, intervals: null, createdAt: d('2026-06-01T09:00:00Z'), updatedAt: d('2026-06-01T09:00:00Z') },
]

// Singleton row — real tenantConfig table only ever has 1 record. Color/
// contact values match what's already shown (as static placeholders) in
// SettingsPage/index.tsx. The 4 masked fields below use the literal
// "[REDACTED]" string; the rest of Email/Social/Client-bot/Notifications
// values here depict a partially-configured salon (independent of those
// pages' own "unconfigured" demo state, since this is just DB row data).
const tenantConfigRows: DbRow[] = [
  {
    id: 'tc1', brandName: 'Loom & Blade', primaryColor: '#b35c37', secondaryColor: '#eaecee', accentColor: '#b35c37', textColor: '#1a1d20', mutedColor: '#6c757d', borderColor: '#e2e8f0', cardColor: '#ffffff', successColor: '#21A67A', errorColor: '#BA1A1A', availableSlotColor: '#21A67A', dayOffColor: '#BA1A1A', workingHourStart: 8, workingHourEnd: 21,
    darkBgColor: '#121417', darkPrimaryColor: '#d0764d', darkAccentColor: '#d0764d', darkCardColor: '#1a1d22', darkTextColor: '#f1f3f5', darkMutedColor: '#8b95a1', darkBorderColor: '#2d3239',
    logoUrl: null, faviconUrl: null, darkLogoUrl: null, themeToggleIconUrl: null, darkThemeToggleIconUrl: null, themeToggleIconSize: 64, logoPositionX: 50, logoPositionY: 50, logoWidth: 120, logoHeight: 40, logoPages: '["home"]', logoLayer: 'above',
    bgType: 'color', bgImageUrl: null, bgGradientFrom: null, bgGradientTo: null, bgGradientAngle: 135, bgApplyToDark: false, logoFullscreen: false,
    darkBgType: 'color', darkBgImageUrl: null, darkBgGradientFrom: null, darkBgGradientTo: null, darkBgGradientAngle: 135,
    salonAddress: 'ul. Grzybowska 62/lok. U4', salonCity: 'Warszawa', salonPhone: '+48 000 000 000', salonEmail: 'hello@loomandblade.pl', salonCompanyName: 'Loom & Blade Sp. z o.o.', salonNip: '000-000-00-00', salonLegalAddress: 'ul. Grzybowska 62/lok. U4, 00-844 Warszawa',
    termsContent_pl: null, termsContent_en: '## Terms of Use\n\nWelcome to Loom & Blade. By booking an appointment...', termsContent_uk: null,
    privacyContent_pl: null, privacyContent_en: '## Privacy Policy\n\nWe respect your privacy and only collect...', privacyContent_uk: null,
    smtpHost: 'smtp.gmail.com', smtpPort: 587, smtpUser: 'hello@loomandblade.pl', smtpPass: '[REDACTED]', smtpFrom: 'Loom & Blade <hello@loomandblade.pl>', smtpSecure: false,
    googleClientId: '812345678901-abc123def456.apps.googleusercontent.com', googleClientSecret: '[REDACTED]',
    appleClientId: 'com.loomandblade.app.service', appleTeamId: 'ABCDE12345', appleKeyId: 'XYZ9876543', applePrivateKey: '[REDACTED]',
    telegramBotToken: '[REDACTED]', telegramBotUsername: 'loomandblade_bot',
    clientBotToken: null, clientBotUsername: '', clientBotSiteUrl: '', clientBotEnabled: false,
    notifEmailEnabled: false, notifTelegramEnabled: false, notifReminder24hEnabled: false, notifReminder2hEnabled: false,
    enabledLocales: '["en"]', homepageWidgetBlock: '{"enabled":true,"images":["/marek.png","/anna.png"]}',
    createdAt: d('2025-01-05T09:00:00Z'), updatedAt: d('2026-08-10T14:30:00Z'),
  },
]

const passwordResetTokenRows: DbRow[] = [
  { id: 'pr1', userId: 'u5', token: 'f4a1c9e2b6d84a3f9c1e7b2a5d6f8091', expiresAt: d('2026-08-18T00:00:00Z'), createdAt: d('2026-08-17T09:00:00Z') },
  { id: 'pr2', userId: 'u6', token: '7b2d4e9a1c3f5081b6d2e4a7c9f01234', expiresAt: d('2026-06-01T00:00:00Z'), createdAt: d('2026-05-31T22:00:00Z') },
  { id: 'pr3', userId: 'u2', token: 'c9e1a4b7d2f6083ae5c1b8d40f2a6791', expiresAt: d('2026-08-20T00:00:00Z'), createdAt: d('2026-08-19T15:00:00Z') },
]

// 6 rows (> the page's mock pageSize of 5) so this table also demonstrates
// real Prev/Next pagination. Not in the real masking list — tokens here are
// fabricated demo strings, not real secrets.
const accountRows: DbRow[] = [
  { id: 'ac1', userId: 'u5', type: 'oauth', provider: 'google', providerAccountId: '109821345678901234567', refresh_token: null, access_token: 'ya29.a0AfH6SMBxk3f9c1e7b2a5d6f8091fake', expires_at: 1755500000, token_type: 'Bearer', scope: 'openid email profile', id_token: 'eyJhbGciOiJSUzI1NiJ9.fake.token', session_state: null },
  { id: 'ac2', userId: 'u3', type: 'oauth', provider: 'google', providerAccountId: '109821345678901234999', refresh_token: null, access_token: 'ya29.a0AfH6SMD8k2f7c3e9b1a4d6f8022fake', expires_at: 1755501200, token_type: 'Bearer', scope: 'openid email profile', id_token: 'eyJhbGciOiJSUzI1NiJ9.fake.token2', session_state: null },
  { id: 'ac3', userId: 'u7', type: 'oauth', provider: 'telegram', providerAccountId: '123456789', refresh_token: null, access_token: null, expires_at: null, token_type: null, scope: null, id_token: null, session_state: null },
  { id: 'ac4', userId: 'u9', type: 'oauth', provider: 'telegram', providerAccountId: '234567891', refresh_token: null, access_token: null, expires_at: null, token_type: null, scope: null, id_token: null, session_state: null },
  { id: 'ac5', userId: 'u4', type: 'oauth', provider: 'google', providerAccountId: '109821345678901235111', refresh_token: null, access_token: 'ya29.a0AfH6SME1k9f2c8e3b7a1d6f8055fake', expires_at: 1755502400, token_type: 'Bearer', scope: 'openid email profile', id_token: 'eyJhbGciOiJSUzI1NiJ9.fake.token3', session_state: null },
  { id: 'ac6', userId: 'u6', type: 'oauth', provider: 'google', providerAccountId: '109821345678901235222', refresh_token: null, access_token: 'ya29.a0AfH6SMF4k1f5c9e2b3a8d6f8077fake', expires_at: 1755503600, token_type: 'Bearer', scope: 'openid email profile', id_token: 'eyJhbGciOiJSUzI1NiJ9.fake.token4', session_state: null },
]

export const MOCK_ROWS: Record<TableName, DbRow[]> = {
  user: userRows,
  masterProfile: masterProfileRows,
  service: serviceRows,
  masterService: masterServiceRows,
  consentRecord: consentRecordRows,
  schedule: scheduleRows,
  appointment: appointmentRows,
  dateOverride: dateOverrideRows,
  tenantConfig: tenantConfigRows,
  passwordResetToken: passwordResetTokenRows,
  account: accountRows,
}
