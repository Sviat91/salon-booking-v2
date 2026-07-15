"use client";

import { useTranslation } from "react-i18next";
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

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-100">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden="true">✓</span>
          {t('gdpr.export.successTitle')}
        </h3>

        <div className="mt-4 space-y-4 text-sm">
          <p>Dane zostały wyeksportowane: {formatDate(exportData.exportTimestamp)}</p>

          <div className="border-t border-emerald-300/50 pt-4">
            <h4 className="font-semibold mb-2">📋 DANE OSOBOWE</h4>
            <div className="space-y-1">
              <div><strong>Imię i nazwisko:</strong> {exportData.personalData.name}</div>
              <div><strong>Numer telefonu:</strong> {exportData.personalData.phone}</div>
              <div><strong>Adres e-mail:</strong> {exportData.personalData.email || 'Brak'}</div>
            </div>
          </div>

          <div className="border-t border-emerald-300/50 pt-4">
            <h4 className="font-semibold mb-2">🔒 HISTORIA ZGÓD</h4>
            {exportData.consentHistory.map((consent, index) => (
              <div key={index} className="mb-3 p-2 bg-emerald-100/50 rounded">
                <div><strong>Zgoda udzielona:</strong> {formatDate(consent.consentDate)}</div>
                <div>• Polityka Prywatności v1.0: {consent.privacyV10 ? '✅ Wyrażono' : '❌ Nie wyrażono'}</div>
                <div>• Warunki Korzystania v1.0: {consent.termsV10 ? '✅ Wyrażono' : '❌ Nie wyrażono'}</div>
                <div>• Powiadomienia: {consent.notificationsV10 ? '✅ Wyrażono' : '❌ Nie wyrażono'}</div>
                {consent.withdrawnDate && (
                  <div className="mt-1 text-orange-700">
                    <strong>Wycofano:</strong> {formatDate(consent.withdrawnDate)} ({consent.withdrawalMethod})
                  </div>
                )}
                <div><strong>Adres IP (zamaskowany):</strong> {consent.ipHash}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-emerald-300/50 pt-4">
            <p><strong>ⓘ</strong> To wszystkie dane osobowe które nam przekazałeś/aś i które przechowujemy w naszym systemie.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onDownloadCSV}
          className="btn btn-outline flex-1"
        >
          Pobierz jako plik CSV
        </button>
        <button
          onClick={onDownloadJSON}
          className="btn btn-outline flex-1"
        >
          Pobierz jako plik JSON
        </button>
        <button className="btn btn-primary flex-1" onClick={onClose}>
          Zamknij
        </button>
      </div>
    </div>
  );
}
