import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, Mail, AlertCircle } from "lucide-react"

export function SmtpInstructions() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Quick Setup Guides
        </CardTitle>
        <CardDescription>How to configure popular email providers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Gmail */}
        <details className="group/details border rounded-lg overflow-hidden bg-card">
          <summary className="cursor-pointer px-4 py-3 font-medium flex items-center justify-between hover:bg-muted/50 transition-colors outline-none list-none [&::-webkit-details-marker]:hidden">
            <span>Gmail / Google Workspace</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open/details:rotate-180" />
          </summary>
          <div className="px-4 py-3 border-t text-sm space-y-2 text-muted-foreground bg-muted/20">
            <p><strong>Host:</strong> smtp.gmail.com</p>
            <p><strong>Port:</strong> 587 (Secure: OFF) or 465 (Secure: ON)</p>
            <div className="flex gap-2 p-3 mt-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 rounded-md items-start">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-xs">
                You <strong>MUST</strong> use an <b>App Password</b>, not your regular password. <br />
                Turn on <b>2-Step Verification</b> in your Google Account, then search for &quot;App Passwords&quot; to generate one.
              </p>
            </div>
          </div>
        </details>

        {/* Outlook */}
        <details className="group/details border rounded-lg overflow-hidden bg-card">
          <summary className="cursor-pointer px-4 py-3 font-medium flex items-center justify-between hover:bg-muted/50 transition-colors outline-none list-none [&::-webkit-details-marker]:hidden">
            <span>Outlook / Office 365</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open/details:rotate-180" />
          </summary>
          <div className="px-4 py-3 border-t text-sm space-y-2 text-muted-foreground bg-muted/20">
            <p><strong>Host:</strong> smtp-mail.outlook.com</p>
            <p><strong>Port:</strong> 587 (Secure: OFF)</p>
            <p><strong>Password:</strong> Use an <b>App Password</b> if you have Two-Step Verification enabled on your Microsoft account.</p>
          </div>
        </details>

        {/* Hostinger */}
        <details className="group/details border rounded-lg overflow-hidden bg-card">
          <summary className="cursor-pointer px-4 py-3 font-medium flex items-center justify-between hover:bg-muted/50 transition-colors outline-none list-none [&::-webkit-details-marker]:hidden">
            <span>Hostinger / cPanel</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open/details:rotate-180" />
          </summary>
          <div className="px-4 py-3 border-t text-sm space-y-2 text-muted-foreground bg-muted/20">
            <p><strong>Host:</strong> smtp.hostinger.com <br /> <span className="text-xs italic">(or your custom domain email like mail.yourdomain.com)</span></p>
            <p><strong>Port:</strong> 465 (Secure: ON)</p>
            <p><strong>Password:</strong> Your email account password.</p>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
