"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { resolveLocalized, type LocalizedField } from "@/lib/localized-content"
import MarkdownLite from "./MarkdownLite"

interface LegalDocumentContact {
  companyName: string | null
  nip: string | null
  legalAddress: string | null
  email: string | null
}

interface LegalDocumentViewProps {
  titleKey: string
  noticeKey: string
  content: LocalizedField
  contact: LegalDocumentContact
}

/**
 * Shared card body for `/terms` and `/privacy`: title, admin-authored body
 * (resolved via `resolveLocalized`, rendered with `MarkdownLite`), the
 * fallback-locale notice, an empty-state notice when nothing is authored yet,
 * and the structured contact block. See `prisma/AGENTS.md`/D2 in the plan for
 * the empty-state/fallback rules — never hide the page, never 404.
 */
export default function LegalDocumentView({ titleKey, noticeKey, content, contact }: LegalDocumentViewProps) {
  const { t } = useTranslation()
  const lang = useCurrentLanguage()
  const resolved = resolveLocalized(content, lang)
  const isFallback = !content[lang]?.trim() && resolved !== ""

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">{t(titleKey)}</h1>
      </div>

      <div className="bg-card backdrop-blur-sm rounded-2xl border border-border p-8">
        {isFallback && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200 mb-0">{t(noticeKey)}</p>
          </div>
        )}

        {resolved ? (
          <MarkdownLite source={resolved} />
        ) : (
          <div className="p-4 bg-muted/30 rounded-lg text-center text-muted-foreground">
            {t("legal.notConfigured")}
          </div>
        )}

        <div className="bg-muted/30 rounded-lg p-6 mt-8">
          {contact.companyName && (
            <h3 className="font-medium text-foreground mb-3">{contact.companyName}</h3>
          )}
          <div className="space-y-2 text-foreground">
            {contact.legalAddress && (
              <p>
                <strong>Adres:</strong> {contact.legalAddress}
              </p>
            )}
            {contact.email && (
              <p>
                <strong>Email:</strong> {contact.email}
              </p>
            )}
            {contact.nip && (
              <p>
                <strong>NIP:</strong> {contact.nip}
              </p>
            )}
            <p>
              <strong>Strona wsparcia:</strong>{" "}
              <Link href="/support" className="text-primary hover:text-primary/80">
                Centrum pomocy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
