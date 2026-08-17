import { ChevronDown, Mail, AlertCircle } from 'lucide-react'
import AdminCard from '../../AdminCard'

const providers = [
  {
    title: 'Gmail / Google Workspace',
    host: 'smtp.gmail.com',
    port: '587 (Secure: OFF) or 465 (Secure: ON)',
    note: 'You MUST use an App Password, not your regular password. Turn on 2-Step Verification in your Google Account, then search for "App Passwords" to generate one.',
  },
  {
    title: 'Outlook / Office 365',
    host: 'smtp-mail.outlook.com',
    port: '587 (Secure: OFF)',
    passwordNote: 'Use an App Password if you have Two-Step Verification enabled on your Microsoft account.',
  },
  {
    title: 'Hostinger / cPanel',
    host: 'smtp.hostinger.com',
    hostNote: '(or your custom domain email like mail.yourdomain.com)',
    port: '465 (Secure: ON)',
    passwordNote: 'Your email account password.',
  },
]

// Ported from the real SmtpInstructions.tsx — collapsible <details> per
// provider, static reference text. The native <details>/<summary> open/close
// is browser behavior, not app state, so it stays interactive; nothing else
// here does anything.
export default function SmtpInstructions() {
  return (
    <AdminCard className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-5 h-5 text-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Quick Setup Guides</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">How to configure popular email providers</p>

      <div className="space-y-3">
        {providers.map((p) => (
          <details key={p.title} className="group/details border border-border rounded-lg overflow-hidden bg-card">
            <summary className="cursor-pointer px-4 py-3 font-medium flex items-center justify-between hover:bg-muted/50 transition-colors outline-none list-none [&::-webkit-details-marker]:hidden">
              <span>{p.title}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open/details:rotate-180" />
            </summary>
            <div className="px-4 py-3 border-t border-border text-sm space-y-2 text-muted-foreground bg-muted/20">
              <p>
                <strong>Host:</strong> {p.host}{' '}
                {p.hostNote && <span className="text-xs italic">{p.hostNote}</span>}
              </p>
              <p>
                <strong>Port:</strong> {p.port}
              </p>
              {p.passwordNote && (
                <p>
                  <strong>Password:</strong> {p.passwordNote}
                </p>
              )}
              {p.note && (
                <div className="flex gap-2 p-3 mt-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 rounded-md items-start">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-xs">{p.note}</p>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </AdminCard>
  )
}
