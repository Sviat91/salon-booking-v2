import type { UserDataExport } from "./types";

export const generateRequestId = () => {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('pl-PL', {
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

export const generateCSV = (data: UserDataExport): string => {
  const rows = [
    ['Typ danych', 'Wartość', 'Data'],
    ['Imię i nazwisko', data.personalData.name, data.exportTimestamp],
    ['Telefon', data.personalData.phone, data.exportTimestamp],
    ['E-mail', data.personalData.email || 'Brak', data.exportTimestamp],
    ['', '', ''], // Empty row
    ['Historia zgód', '', ''],
  ];

  data.consentHistory.forEach((consent, index) => {
    rows.push([
      `Zgoda ${index + 1} - Data udzielenia`,
      formatDate(consent.consentDate),
      consent.consentDate
    ]);
    rows.push([
      `Zgoda ${index + 1} - Polityka Prywatności v1.0`,
      consent.privacyV10 ? 'Wyrażono' : 'Nie wyrażono',
      consent.consentDate
    ]);
    rows.push([
      `Zgoda ${index + 1} - Warunki Korzystania v1.0`,
      consent.termsV10 ? 'Wyrażono' : 'Nie wyrażono',
      consent.consentDate
    ]);
    rows.push([
      `Zgoda ${index + 1} - Powiadomienia`,
      consent.notificationsV10 ? 'Wyrażono' : 'Nie wyrażono',
      consent.consentDate
    ]);
    if (consent.withdrawnDate) {
      rows.push([
        `Zgoda ${index + 1} - Data wycofania`,
        formatDate(consent.withdrawnDate),
        consent.withdrawnDate
      ]);
      rows.push([
        `Zgoda ${index + 1} - Sposób wycofania`,
        consent.withdrawalMethod || 'Nieznany',
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
