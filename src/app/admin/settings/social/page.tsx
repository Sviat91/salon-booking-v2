import { Metadata } from "next"
import SocialSettingsForm from "@/components/admin/SocialSettingsForm"
import { getServerT } from "@/lib/i18n-server"

export const metadata: Metadata = {
  title: "Social Login Settings | Admin",
  description: "Configure Google, Apple, and Telegram authentication",
}

export default function SocialSettingsPage() {
  const t = getServerT()
  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">{t('admin.settings.configurationEyebrow')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.settings.social.pageDesc')}
        </p>
      </div>

      <SocialSettingsForm />
    </div>
  )
}
