"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentLanguage } from "@/contexts/LanguageContext";
import PhoneInput from "./ui/PhoneInput";
import { clientLog } from "@/lib/client-logger";
import { useSession } from "next-auth/react";
import type { ModalState, ApiError, UserDataExport } from "./data-export/types";
import { generateRequestId, generateCSV, generateJSON, downloadFile } from "./data-export/exportFormat";
import ExportResultView from "./data-export/ExportResultView";

type DataExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function DataExportModal({
  isOpen,
  onClose,
}: DataExportModalProps) {
  const { t } = useTranslation();
  const language = useCurrentLanguage();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as
    | string
    | undefined;
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<ModalState>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [exportData, setExportData] = useState<UserDataExport | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string>(() => generateRequestId());
  const { data: session } = useSession();
  const isAuth = !!session?.user;

  const resetTurnstile = useCallback(() => {
    setToken(null);
    if (!siteKey || typeof window === "undefined") {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const turnstile = (window as any)?.turnstile;
    if (turnstile && widgetIdRef.current) {
      try {
        turnstile.reset(widgetIdRef.current);
      } catch (err) {
        clientLog.warn("Turnstile reset failed", err);
      }
    }
  }, [siteKey]);

  const resetForm = useCallback(() => {
    setName("");
    setPhone("");
    setEmail("");
    setState("idle");
    setError(null);
    setExportData(null);
    setRequestId(generateRequestId());
    resetTurnstile();
  }, [resetTurnstile]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  // Focus management
  useEffect(() => {
    if (!isOpen) return;
    const timeout = setTimeout(() => {
      firstFieldRef.current?.focus();
    }, 50);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  // Prevent body scroll while modal open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // ESC handling
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose, isOpen]);

  // Load Turnstile
  useEffect(() => {
    if (!isOpen || !siteKey || isAuth) return;
    const scriptId = "cf-turnstile";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const interval = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const turnstile = (window as any)?.turnstile;
      if (turnstile && turnstileRef.current && !widgetIdRef.current) {
        try {
          widgetIdRef.current = turnstile.render(turnstileRef.current, {
            sitekey: siteKey,
            language: language === 'uk' ? 'uk-ua' : language,
            callback: (value: string) => setToken(value),
            "error-callback": () => resetTurnstile(),
            "expired-callback": () => resetTurnstile(),
          });
          clearInterval(interval);
        } catch (err) {
          clientLog.warn("Turnstile render failed", err);
        }
      }
    }, 200);

    return () => {
      clearInterval(interval);
      if (!siteKey || typeof window === "undefined") {
        widgetIdRef.current = null;
        return;
      }
      const turnstile = (window as any)?.turnstile;
      if (turnstile && widgetIdRef.current) {
        try {
          turnstile.remove(widgetIdRef.current);
        } catch (err) {
          clientLog.warn("Turnstile cleanup failed", err);
        }
      }
      widgetIdRef.current = null;
    };
  }, [isOpen, resetTurnstile, siteKey, isAuth]);

  if (!isOpen) return null;

  const canSubmit = isAuth ? (state !== "loading") : (
    name.trim().length >= 2 &&
    phone.replace(/\D/g, "").length >= 8 &&
    (siteKey ? !!token : true) &&
    state !== "loading"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setState("loading");
    setError(null);

    try {
      const res = await fetch("/api/consents/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: isAuth ? undefined : name.trim(),
          phone: isAuth ? undefined : phone,
          email: isAuth ? undefined : (email.trim() || undefined),
          turnstileToken: isAuth ? undefined : (token ?? undefined),
          requestId,
        }),
      });

      if (res.status === 404) {
        const payload = (await res.json()) as ApiError;
        setError(payload);
        setState("not-found");
        resetTurnstile();
        setRequestId(generateRequestId());
        return;
      }

      if (!res.ok) {
        const payload = (await res.json()) as ApiError;
        setError(payload);
        setState("error");
        resetTurnstile();
        setRequestId(generateRequestId());
        return;
      }

      const exportPayload = (await res.json()) as UserDataExport;
      setExportData(exportPayload);
      setState("success");
    } catch (err) {
      clientLog.error("Data export failed", err);
      setError({
        error: t('gdpr.networkError'),
        code: "NETWORK_ERROR",
      });
      setState("error");
      resetTurnstile();
      setRequestId(generateRequestId());
    }
  }

  const handleDownloadCSV = () => {
    if (!exportData) return;
    const csv = generateCSV(exportData, t, language);
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, '').replace('T', '-');
    downloadFile(csv, `gdpr-export-${timestamp}.csv`, 'text/csv;charset=utf-8');
  };

  const handleDownloadJSON = () => {
    if (!exportData) return;
    const json = generateJSON(exportData);
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, '').replace('T', '-');
    downloadFile(json, `gdpr-export-${timestamp}.json`, 'application/json;charset=utf-8');
  };

  const showHints = !!(error?.hints && error.hints.length > 0);
  const isLoading = state === "loading";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="export-modal-title" className="text-xl font-semibold text-foreground">
              {t('gdpr.export.title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('gdpr.export.subtitle')}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted"
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>

        {state === "success" && exportData ? (
          <ExportResultView
            exportData={exportData}
            onDownloadCSV={handleDownloadCSV}
            onDownloadJSON={handleDownloadJSON}
            onClose={handleClose}
          />
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            {!isAuth && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="export-name">
                  {t('form.name')}
                </label>
                  <input
                    id="export-name"
                    ref={firstFieldRef}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder={t('gdpr.export.namePlaceholder')}
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="export-phone">
                  {t('form.phone')}
                </label>
                  <PhoneInput
                    value={phone}
                    onChange={setPhone}
                    placeholder={t('gdpr.export.phonePlaceholder')}
                    error={state === "error" && error?.code === "INVALID_PHONE" ? error.error : undefined}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="export-email">
                  {t('form.email')} <span className="text-xs text-muted-foreground">({t('gdpr.export.emailOptional')})</span>
                  </label>
                  <input
                    id="export-email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder={t('gdpr.export.emailPlaceholder')}
                    autoComplete="email"
                  />
                </div>
              </>
            )}

            {!isAuth && siteKey && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <div ref={turnstileRef} />
              </div>
            )}

            {error && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-900/30 dark:text-red-200"
                role="alert"
                aria-live="assertive"
              >
                <p className="font-medium">{error.error}</p>
                {showHints && (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {error.hints!.map((hint) => (
                      <li key={hint}>{hint}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="btn btn-outline flex-1"
                onClick={handleClose}
                disabled={isLoading}
              >
                Anuluj
              </button>
              <button
                type="submit"
                className={`btn btn-primary flex-1 ${!canSubmit ? 'opacity-60 pointer-events-none' : ''}`}
                disabled={!canSubmit || isLoading}
              >
                {isLoading ? t('gdpr.export.loading') : t('gdpr.export.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
