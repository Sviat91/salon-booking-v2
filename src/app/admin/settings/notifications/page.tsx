import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import NotificationSettingsForm from './NotificationSettingsForm'

export const metadata: Metadata = {
  title: 'Notification Settings | Admin',
  description: 'Configure email and Telegram notification channels',
}

export default async function NotificationSettingsPage() {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    redirect('/admin')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notification Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure email and Telegram channels for booking confirmations, reminders, and contact form alerts.
        </p>
      </div>
      <NotificationSettingsForm />
    </div>
  )
}
