"use client"
import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import { toast } from "sonner"

const formSchema = z.object({
  smtpHost: z.string().min(1, "SMTP Host is required").or(z.literal("")),
  smtpPort: z.string().superRefine((val, ctx) => {
    if (val !== "" && isNaN(parseInt(val, 10))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be a valid port number" })
    }
  }).or(z.literal("")),
  smtpUser: z.string().or(z.literal("")),
  smtpPass: z.string().or(z.literal("")),
  smtpFrom: z.string().or(z.literal("")),
  smtpSecure: z.boolean(),
})

type EmailSettingsFormValues = z.infer<typeof formSchema>

export default function EmailSettingsForm() {
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isTesting, setIsTesting] = React.useState(false)
  const [testEmailDialogOpen, setTestEmailDialogOpen] = React.useState(false)
  const [testEmail, setTestEmail] = React.useState("")

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
        if (!res.ok) throw new Error("Failed to load")
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
        toast.error("Could not load email settings")
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
        const errData = await res.json()
        throw new Error(errData.error || "Failed to update")
      }

      toast.success("Email settings saved safely")
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTestEmail() {
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Please enter a valid email address.")
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

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send test email")

      toast.success("Test email sent successfully!")
      setTestEmailDialogOpen(false)
      setTestEmail("")
    } catch (err: any) {
      toast.error(err.message || "Failed to send test email")
    } finally {
      setIsTesting(false)
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground animate-pulse">Loading settings...</div>
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-card border border-border p-6 rounded-xl">
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="smtpHost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SMTP Host</FormLabel>
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
                <FormLabel>SMTP Port</FormLabel>
                <FormControl>
                  <Input placeholder="587" {...field} />
                </FormControl>
                <FormDescription>Usually 587 (STARTTLS) or 465 (SSL)</FormDescription>
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
                <FormLabel>SMTP Username / Email</FormLabel>
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
                <FormLabel>SMTP Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="App Password" autoComplete="new-password" {...field} />
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
              <FormLabel>Sender Display Name (From)</FormLabel>
              <FormControl>
                <Input placeholder="Salon Beauty <info@salon-beauty.com>" {...field} />
              </FormControl>
              <FormDescription>Format: Name &lt;email@domain.com&gt;</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="smtpSecure"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Secure Connection (SSL)</FormLabel>
                <FormDescription>
                  Enable this if your port is 465. Keep disabled (flase) for port 587 (STARTTLS).
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
            {isSaving ? "Saving..." : "Save Config"}
          </Button>

          <Button 
            type="button" 
            variant="secondary" 
            onClick={() => setTestEmailDialogOpen(true)}
            disabled={isTesting || isLoading || isSaving}
            className="w-full sm:w-auto"
          >
            {isTesting ? "Sending Test..." : "Save & Send Test Email"}
          </Button>
        </div>
      </form>

      <Dialog open={testEmailDialogOpen} onOpenChange={setTestEmailDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Enter an email address to receive a test message. This will save your current settings and test the connection.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="test-email" className="text-right text-sm font-medium">
                Email
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
              Cancel
            </Button>
            <Button onClick={handleTestEmail} disabled={isTesting || isSaving}>
              {isTesting ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  )
}
