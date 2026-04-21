import { Metadata } from "next"
import EmailSettingsForm from "@/components/admin/EmailSettingsForm"
import { SmtpInstructions } from "@/components/admin/SmtpInstructions"

export const metadata: Metadata = {
  title: "Email Settings | Admin",
  description: "Configure SMTP settings for sending emails",
}

export default function EmailSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email Settings (SMTP)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure how the application sends emails for password resets, booking confirmations, and other notifications.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <EmailSettingsForm />
        </div>
        <div className="lg:col-span-1">
          <SmtpInstructions />
        </div>
      </div>
    </div>
  )
}
