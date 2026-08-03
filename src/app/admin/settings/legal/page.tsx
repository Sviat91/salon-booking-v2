import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getServerT } from '@/lib/i18n-server'
import { getTenantConfig } from '@/lib/tenant'
import { parseEnabledLocales } from '@/lib/localized-content'
import LegalSettingsForm from './LegalSettingsForm'

export const metadata: Metadata = {
  title: 'Legal Documents | Admin',
  description: 'Edit the Terms of Use and Privacy Policy documents',
}

export default async function LegalSettingsPage() {
  const t = getServerT()
  const session = await auth()
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    redirect('/admin')
  }

  const config = await getTenantConfig()
  const enabledLocales = parseEnabledLocales(config.enabledLocales)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">{t('admin.settings.configurationEyebrow')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.settings.legal.pageDesc')}
        </p>
      </div>
      <LegalSettingsForm
        config={{
          termsContent_pl: config.termsContent_pl,
          termsContent_en: config.termsContent_en,
          termsContent_uk: config.termsContent_uk,
          privacyContent_pl: config.privacyContent_pl,
          privacyContent_en: config.privacyContent_en,
          privacyContent_uk: config.privacyContent_uk,
        }}
        enabledLocales={enabledLocales}
      />
    </div>
  )
}
