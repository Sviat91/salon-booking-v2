"use client"
import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SettingsSection } from "@/app/admin/settings/FormFields"
import { toast } from "sonner"
import { apiErrorKey } from "@/lib/errors/apiErrorKey"

function buildFormSchema(t: (key: string) => string) {
  return z.object({
    smtpHost: z.string().min(1, t('admin.settings.email.smtpHostRequired')).or(z.literal("")),
    smtpPort: z.string().superRefine((val, ctx) => {
      if (val !== "" && isNaN(parseInt(val, 10))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('admin.settings.email.invalidPort') })
      }
    }).or(z.literal("")),
    smtpUser: z.string().or(z.literal("")),
    smtpPass: z.string().or(z.literal("")),
    smtpFrom: z.string().or(z.literal("")),
    smtpSecure: z.boolean(),
  })
}

type EmailSettingsFormValues = z.infer<ReturnType<typeof buildFormSchema>>

export default function EmailSettingsForm() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isTesting, setIsTesting] = React.useState(false)
  const [testEmailDialogOpen, setTestEmailDialogOpen] = React.useState(false)
  const [testEmail, setTestEmail] = React.useState("")

  const formSchema = React.useMemo(() => buildFormSchema(t), [t])

  const form = useForm<EmailSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      smtpHost: "",
      smtpPort: "587",
      smtpUser: "",
      smtpPass: "",
      smtpFrom: "",
      smtpSecure: false,
    },
  })

  // Fetch current configs on mount
  React.useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/admin/email-settings")
        if (!res.ok) throw new Error(t('errors.generic'))
        const data = await res.json()
        form.reset({
          smtpHost: data.smtpHost || "",
          smtpPort: String(data.smtpPort || "587"),
          smtpUser: data.smtpUser || "",
          smtpPass: data.smtpPass || "",
          smtpFrom: data.smtpFrom || "",
          smtpSecure: data.smtpSecure || false,
        })
      } catch (err) {
        toast.error(t('admin.settings.email.loadError'))
      } finally {
        setIsLoading(false)
      }
    }
    loadConfig()
  }, [form])

  async function onSubmit(data: EmailSettingsFormValues) {
    setIsSaving(true)
    try {
      const res = await fetch("/api/admin/email-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(t(apiErrorKey(errData.code)))
      }

      toast.success(t('admin.settings.email.saveSuccess'))
    } catch (err: any) {
      toast.error(err.message || t('admin.settings.email.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTestEmail() {
    if (!testEmail || !testEmail.includes("@")) {
      toast.error(t('admin.settings.email.testEmailInvalid'))
      return
    }

    setIsTesting(true)
    try {
      // Attempt to save first to ensure testing latest config
      await onSubmit(form.getValues())

      const res = await fetch("/api/admin/email-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(t(apiErrorKey(data.code)))

      toast.success(t('admin.settings.email.testEmailSuccess'))
      setTestEmailDialogOpen(false)
      setTestEmail("")
    } catch (err: any) {
      toast.error(err.message || t('admin.settings.email.testEmailFailed'))
    } finally {
      setIsTesting(false)
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground animate-pulse">{t('admin.settings.email.loading')}</div>
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl">
        <SettingsSection title={t('admin.settings.email.sectionTitle')} description={t('admin.settings.email.sectionDesc')}>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="smtpHost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.settings.email.smtpHost')}</FormLabel>
                <FormControl>
                  <Input placeholder="smtp.gmail.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="smtpPort"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.settings.email.smtpPort')}</FormLabel>
                <FormControl>
                  <Input placeholder="587" {...field} />
                </FormControl>
                <FormDescription>{t('admin.settings.email.smtpPortDesc')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="smtpUser"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.settings.email.smtpUser')}</FormLabel>
                <FormControl>
                  <Input placeholder="user@example.com" {...field} autoComplete="new-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="smtpPass"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.settings.email.smtpPass')}</FormLabel>
                <FormControl>
                  <Input type="password" placeholder={t('admin.settings.email.appPasswordPlaceholder')} autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="smtpFrom"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('admin.settings.email.smtpFrom')}</FormLabel>
              <FormControl>
                <Input placeholder="Salon Beauty <info@salon-beauty.com>" {...field} />
              </FormControl>
              <FormDescription>{t('admin.settings.email.smtpFromDesc')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="smtpSecure"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-[20px] border border-border bg-muted/30 p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">{t('admin.settings.email.smtpSecure')}</FormLabel>
                <FormDescription>
                  {t('admin.settings.email.smtpSecureDesc')}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t">
          <Button type="submit" disabled={isSaving || isLoading}>
            {isSaving ? t('admin.settings.email.savingConfig') : t('admin.settings.email.saveConfig')}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setTestEmailDialogOpen(true)}
            disabled={isTesting || isLoading || isSaving}
            className="w-full sm:w-auto"
          >
            {isTesting ? t('admin.settings.email.sendingTest') : t('admin.settings.email.saveAndTest')}
          </Button>
        </div>
        </SettingsSection>
      </form>

      <Dialog open={testEmailDialogOpen} onOpenChange={setTestEmailDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('admin.settings.email.sendTestTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.settings.email.sendTestDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="test-email" className="text-right text-sm font-medium">
                {t('admin.settings.email.emailField')}
              </label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                autoComplete="email"
                placeholder="test@example.com"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestEmailDialogOpen(false)} disabled={isTesting || isSaving}>
              {t('admin.settings.email.cancel')}
            </Button>
            <Button onClick={handleTestEmail} disabled={isTesting || isSaving}>
              {isTesting ? t('admin.settings.email.sending') : t('admin.settings.email.sendEmail')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  )
}
