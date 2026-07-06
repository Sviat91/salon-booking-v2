import { Metadata } from "next"
import SocialSettingsForm from "@/components/admin/SocialSettingsForm"

export const metadata: Metadata = {
  title: "Social Login Settings | Admin",
  description: "Configure Google, Apple, and Telegram authentication",
}

export default function SocialSettingsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Configuration</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill in keys to automatically enable social logins. Leave everything blank to disable a provider.
          Secrets are encrypted securely in the database.
        </p>
      </div>

      <SocialSettingsForm />
    </div>
  )
}
