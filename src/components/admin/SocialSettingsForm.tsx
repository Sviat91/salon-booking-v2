"use client"
import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { SettingsSection } from "@/app/admin/settings/FormFields"
import { toast } from "sonner"

const formSchema = z.object({
  googleClientId: z.string().optional(),
  googleClientSecret: z.string().optional(),
  appleClientId: z.string().optional(),
  appleTeamId: z.string().optional(),
  appleKeyId: z.string().optional(),
  applePrivateKey: z.string().optional(),
  telegramBotUsername: z.string().optional(),
  telegramBotToken: z.string().optional(),
})

type SocialSettingsValues = z.infer<typeof formSchema>

export default function SocialSettingsForm() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)

  const form = useForm<SocialSettingsValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      googleClientId: "",
      googleClientSecret: "",
      appleClientId: "",
      appleTeamId: "",
      appleKeyId: "",
      applePrivateKey: "",
      telegramBotUsername: "",
      telegramBotToken: "",
    },
  })

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/social-settings")
        if (!res.ok) throw new Error()
        const data = await res.json()
        form.reset({
          googleClientId: data.googleClientId || "",
          googleClientSecret: data.googleClientSecret || "",
          appleClientId: data.appleClientId || "",
          appleTeamId: data.appleTeamId || "",
          appleKeyId: data.appleKeyId || "",
          applePrivateKey: data.applePrivateKey || "",
          telegramBotUsername: data.telegramBotUsername || "",
          telegramBotToken: data.telegramBotToken || "",
        })
      } catch (err) {
        toast.error(t('admin.settings.social.loadError'))
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [form])

  async function onSubmit(data: SocialSettingsValues) {
    setIsSaving(true)
    try {
      const res = await fetch("/api/admin/social-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()

      // refresh inputs in case secrets were masked
      const refresh = await fetch("/api/admin/social-settings")
      if (refresh.ok) {
        const newData = await refresh.json()
        form.reset(newData)
      }

      toast.success(t('admin.settings.social.saveSuccess'))
    } catch {
      toast.error(t('admin.settings.social.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="animate-pulse text-sm text-muted-foreground">{t('admin.settings.social.loading')}</div>

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* Google */}
        <SettingsSection
          title={t('admin.settings.social.googleTitle')}
          description={t('admin.settings.social.googleDesc')}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="googleClientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.settings.social.googleClientId')}</FormLabel>
                  <FormControl>
                    <Input placeholder="123456...apps.googleusercontent.com" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="googleClientSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.settings.social.googleClientSecret')}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="GOCSPX-..." autoComplete="new-password" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </SettingsSection>

        {/* Telegram */}
        <SettingsSection
          title={t('admin.settings.social.telegramTitle')}
          description={t('admin.settings.social.telegramDesc')}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="telegramBotUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.settings.social.telegramBotUsername')}</FormLabel>
                  <FormControl>
                    <Input placeholder="my_salon_auth_bot" {...field} />
                  </FormControl>
                  <FormDescription>{t('admin.settings.social.telegramBotUsernameDesc')}</FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="telegramBotToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.settings.social.telegramBotToken')}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="123456:ABC-DEF123..." autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormDescription>{t('admin.settings.social.telegramBotTokenDesc')}</FormDescription>
                </FormItem>
              )}
            />
          </div>
        </SettingsSection>

        {/* Apple */}
        <SettingsSection
          title={t('admin.settings.social.appleTitle')}
          description={t('admin.settings.social.appleDesc')}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="appleClientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.settings.social.appleClientId')}</FormLabel>
                  <FormControl>
                    <Input placeholder="com.example.salon.auth" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="appleTeamId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.settings.social.appleTeamId')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('admin.settings.social.appleTeamIdPlaceholder')} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="appleKeyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.settings.social.appleKeyId')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('admin.settings.social.appleKeyIdPlaceholder')} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="applePrivateKey"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>{t('admin.settings.social.applePrivateKey')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                      className="min-h-[120px] font-mono"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>{t('admin.settings.social.applePrivateKeyDesc')}</FormDescription>
                </FormItem>
              )}
            />
          </div>
        </SettingsSection>

        <div className="flex border-t pt-4">
          <Button type="submit" disabled={isSaving || isLoading}>
            {isSaving ? t('admin.settings.social.savingConfig') : t('admin.settings.social.saveConfig')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
