import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getTenantConfig } from '@/lib/tenant'
import { parseEnabledLocales } from '@/lib/localized-content'
import { getServerT } from '@/lib/i18n-server'
import ReminderTemplatesForm from './ReminderTemplatesForm'

export const metadata: Metadata = {
  title: 'Reminder Templates | Admin',
  description: 'Author reminder body text per channel and language',
}

export default async function ReminderTemplatesPage() {
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
          {t('admin.settings.reminderTemplates.pageDesc')}
        </p>
      </div>
      <ReminderTemplatesForm enabledLocales={enabledLocales} />
    </div>
  )
}
