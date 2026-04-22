"use client"
import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
        toast.error("Could not load settings")
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

      toast.success("Social login settings saved safely")
    } catch {
      toast.error("Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="animate-pulse text-sm text-muted-foreground">Loading settings...</div>

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Google */}
        <Card>
          <CardHeader>
            <CardTitle>Google Auth</CardTitle>
            <CardDescription>Get these credentials from the Google Cloud Console (APIs & Services -&gt; Credentials).</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="googleClientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client ID</FormLabel>
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
                  <FormLabel>Client Secret</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="GOCSPX-..." autoComplete="new-password" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Telegram */}
        <Card>
          <CardHeader>
            <CardTitle>Telegram Auth</CardTitle>
            <CardDescription>Talk to @BotFather in Telegram, create a bot and map your domain via /setdomain.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="telegramBotUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot Username</FormLabel>
                  <FormControl>
                    <Input placeholder="my_salon_auth_bot" {...field} />
                  </FormControl>
                  <FormDescription>Exclude the @ symbol</FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="telegramBotToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot Token</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="123456:ABC-DEF123..." autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormDescription>Encrypted on save.</FormDescription>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Apple */}
        <Card>
          <CardHeader>
            <CardTitle>Apple Auth</CardTitle>
            <CardDescription>Requires an active Apple Developer Program membership.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="appleClientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Services ID (Client ID)</FormLabel>
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
                  <FormLabel>Team ID</FormLabel>
                  <FormControl>
                    <Input placeholder="10-character Team ID" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="appleKeyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key ID</FormLabel>
                  <FormControl>
                    <Input placeholder="10-character Key ID" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="applePrivateKey"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Private Key (.p8 contents)</FormLabel>
                  <FormControl>
                    <textarea 
                      placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----" 
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[120px] font-mono"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>Paste the entire contents of the .p8 file you downloaded. Encrypted on save.</FormDescription>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex border-t pt-4">
          <Button type="submit" disabled={isSaving || isLoading}>
            {isSaving ? "Saving..." : "Save Config"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
