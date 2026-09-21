import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import GoogleCalendarSettingsForm from './GoogleCalendarSettingsForm'
import { getServerT } from '@/lib/i18n-server'

export const metadata: Metadata = {
  title: 'Google Calendar | Admin',
  description: 'Configure Google Calendar sync',
}

export default async function GoogleCalendarSettingsPage() {
  const t = getServerT()
  const session = await auth()
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    redirect('/admin')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">{t('admin.settings.configurationEyebrow')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.settings.googleCalendar.pageDesc')}
        </p>
      </div>
      <GoogleCalendarSettingsForm />
    </div>
  )
}
