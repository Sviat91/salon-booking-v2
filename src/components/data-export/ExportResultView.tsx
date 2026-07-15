"use client";

import { useTranslation } from "react-i18next";
import { useCurrentLanguage } from "@/contexts/LanguageContext";
import { localeFor } from "@/lib/i18n";
import { formatDate } from "./exportFormat";
import type { UserDataExport } from "./types";

type ExportResultViewProps = {
  exportData: UserDataExport;
  onDownloadCSV: () => void;
  onDownloadJSON: () => void;
  onClose: () => void;
};

export default function ExportResultView({
  exportData,
  onDownloadCSV,
  onDownloadJSON,
  onClose,
}: ExportResultViewProps) {
  const { t } = useTranslation();
  const locale = localeFor(useCurrentLanguage());

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-100">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden="true">✓</span>
          {t('gdpr.export.successTitle')}
        </h3>

        <div className="mt-4 space-y-4 text-sm">
          <p>{t('gdpr.export.exportedAt')}: {formatDate(exportData.exportTimestamp, locale)}</p>

          <div className="border-t border-emerald-300/50 pt-4">
            <h4 className="font-semibold mb-2">📋 {t('gdpr.export.personalData')}</h4>
            <div className="space-y-1">
              <div><strong>{t('gdpr.export.name')}:</strong> {exportData.personalData.name}</div>
              <div><strong>{t('gdpr.export.phone')}:</strong> {exportData.personalData.phone}</div>
              <div><strong>{t('gdpr.export.email')}:</strong> {exportData.personalData.email || t('gdpr.export.noEmail')}</div>
            </div>
          </div>

          <div className="border-t border-emerald-300/50 pt-4">
            <h4 className="font-semibold mb-2">🔒 {t('gdpr.export.consentHistory')}</h4>
            {exportData.consentHistory.map((consent, index) => (
              <div key={index} className="mb-3 p-2 bg-emerald-100/50 rounded">
                <div><strong>{t('gdpr.export.consentGiven')}:</strong> {formatDate(consent.consentDate, locale)}</div>
                <div>• {t('gdpr.export.privacyPolicy')}: {consent.privacyV10 ? `✅ ${t('gdpr.export.given')}` : `❌ ${t('gdpr.export.notGiven')}`}</div>
                <div>• {t('gdpr.export.terms')}: {consent.termsV10 ? `✅ ${t('gdpr.export.given')}` : `❌ ${t('gdpr.export.notGiven')}`}</div>
                <div>• {t('gdpr.export.notifications')}: {consent.notificationsV10 ? `✅ ${t('gdpr.export.given')}` : `❌ ${t('gdpr.export.notGiven')}`}</div>
                {consent.withdrawnDate && (
                  <div className="mt-1 text-orange-700">
                    <strong>{t('gdpr.export.withdrawn')}:</strong> {formatDate(consent.withdrawnDate, locale)} ({consent.withdrawalMethod})
                  </div>
                )}
                <div><strong>{t('gdpr.export.ipMasked')}:</strong> {consent.ipHash}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-emerald-300/50 pt-4">
            <p><strong>ⓘ</strong> {t('gdpr.export.allDataNotice')}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onDownloadCSV}
          className="btn btn-outline flex-1"
        >
          {t('gdpr.export.downloadCSV')}
        </button>
        <button
          onClick={onDownloadJSON}
          className="btn btn-outline flex-1"
        >
          {t('gdpr.export.downloadJSON')}
        </button>
        <button className="btn btn-primary flex-1" onClick={onClose}>
          {t('gdpr.export.close')}
        </button>
      </div>
    </div>
  );
}
