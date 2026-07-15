import type { TFunction } from "i18next";
import type { UserDataExport } from "./types";
import type { Language } from "@/lib/i18n";
import { localeFor } from "@/lib/i18n";

export const generateRequestId = () => {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const formatDate = (dateString: string, locale: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

export const generateCSV = (data: UserDataExport, t: TFunction, language: Language): string => {
  const locale = localeFor(language);
  const rows = [
    [t('gdpr.export.csv.dataType'), t('gdpr.export.csv.value'), t('gdpr.export.csv.date')],
    [t('gdpr.export.csv.name'), data.personalData.name, data.exportTimestamp],
    [t('gdpr.export.csv.phone'), data.personalData.phone, data.exportTimestamp],
    [t('gdpr.export.csv.email'), data.personalData.email || t('gdpr.export.csv.none'), data.exportTimestamp],
    ['', '', ''], // Empty row
    [t('gdpr.export.csv.consentHistory'), '', ''],
  ];

  data.consentHistory.forEach((consent, index) => {
    const n = index + 1;
    rows.push([
      t('gdpr.export.csv.consentGrantedDate', { n }),
      formatDate(consent.consentDate, locale),
      consent.consentDate
    ]);
    rows.push([
      t('gdpr.export.csv.consentPrivacyPolicy', { n }),
      consent.privacyV10 ? t('gdpr.export.csv.given') : t('gdpr.export.csv.notGiven'),
      consent.consentDate
    ]);
    rows.push([
      t('gdpr.export.csv.consentTerms', { n }),
      consent.termsV10 ? t('gdpr.export.csv.given') : t('gdpr.export.csv.notGiven'),
      consent.consentDate
    ]);
    rows.push([
      t('gdpr.export.csv.consentNotifications', { n }),
      consent.notificationsV10 ? t('gdpr.export.csv.given') : t('gdpr.export.csv.notGiven'),
      consent.consentDate
    ]);
    if (consent.withdrawnDate) {
      rows.push([
        t('gdpr.export.csv.withdrawnDate', { n }),
        formatDate(consent.withdrawnDate, locale),
        consent.withdrawnDate
      ]);
      rows.push([
        t('gdpr.export.csv.withdrawalMethod', { n }),
        consent.withdrawalMethod || t('gdpr.export.csv.unknown'),
        consent.withdrawnDate
      ]);
    }
    rows.push(['', '', '']); // Empty row between consents
  });

  return rows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
};

export const generateJSON = (data: UserDataExport): string => {
  return JSON.stringify(data, null, 2);
};

export const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
