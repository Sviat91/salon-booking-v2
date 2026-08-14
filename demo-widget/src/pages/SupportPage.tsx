import { useState } from 'react'
import LegalPageHeader from '../components/legal/LegalPageHeader'

const SUBJECT_OPTIONS = [
  { value: '', label: 'Select a topic' },
  { value: 'booking', label: 'Booking' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'privacy', label: 'Privacy and data' },
  { value: 'other', label: 'Other' },
]

// Ported from the real src/app/support/page.tsx, simplified: no Turnstile
// (no real backend to protect), submit is a local mock success state, and
// the subject field is a plain <select> instead of the real Radix-based
// Select primitive (not part of what was being visually compared). The GDPR
// "Quick Actions" (erase/export/withdraw) open real account-verification
// modals in the live app — there's no real account here, so those buttons
// stay visually present but inert, same treatment as the Footer links were
// before this pass wired them up.
export default function SupportPage() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setFormData({ name: '', email: '', subject: '', message: '' })
  }

  return (
    <main className="relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">
      <LegalPageHeader />
      <div className="container mx-auto max-w-6xl px-3 sm:px-6 pt-4 pb-6">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-3">Help Center</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">We're here to help</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-card backdrop-blur-sm rounded-2xl border border-border p-6 text-foreground">
              <h2 className="text-xl font-semibold text-foreground mb-4">Contact form</h2>

              {submitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">Message sent!</h3>
                  <p className="text-muted-foreground mb-6">Thank you for contacting us. We'll respond as soon as possible.</p>
                  <button onClick={() => setSubmitted(false)} className="btn btn-primary">
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Full name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">E-mail *</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Subject *</label>
                    <select
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData((f) => ({ ...f, subject: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {SUBJECT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Message *</label>
                    <textarea
                      required
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData((f) => ({ ...f, message: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>

                  <button type="submit" className="btn btn-primary w-full py-3">
                    Send message
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card backdrop-blur-sm rounded-2xl border border-border p-5">
              <h3 className="text-lg font-semibold text-foreground mb-3">Contact Information</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Address</h4>
                    <p className="text-sm text-muted-foreground">
                      ul. Grzybowska 62/lok. U4
                      <br />
                      00-844 Warszawa
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Response Time</h4>
                    <p className="text-sm text-muted-foreground">
                      Usually within 72 hours
                      <br />
                      on business days
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card backdrop-blur-sm rounded-2xl border border-border p-5">
              <h3 className="text-lg font-semibold text-foreground mb-3">Quick Actions</h3>
              <div className="space-y-3">
                <div className="w-full text-left p-3 rounded-lg border border-border cursor-default">
                  <div className="font-medium text-foreground text-sm">Delete my data</div>
                  <div className="text-xs text-muted-foreground">Right to be forgotten</div>
                </div>
                <div className="w-full text-left p-3 rounded-lg border border-border cursor-default">
                  <div className="font-medium text-foreground text-sm">Export my data</div>
                  <div className="text-xs text-muted-foreground">Export data</div>
                </div>
                <div className="w-full text-left p-3 rounded-lg border border-border cursor-default">
                  <div className="font-medium text-foreground text-sm">Withdraw consents</div>
                  <div className="text-xs text-muted-foreground">Withdraw consents</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
