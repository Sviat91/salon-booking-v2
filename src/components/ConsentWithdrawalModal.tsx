"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import PhoneInput from "./ui/PhoneInput";
import { clientLog } from "@/lib/client-logger";
import { useCurrentLanguage } from "@/contexts/LanguageContext";
import { useSession } from "next-auth/react";

type ModalState =
  | "idle"
  | "loading"
  | "success"
  | "already-processed"
  | "not-found"
  | "error";

type ConsentWithdrawalModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

interface ApiError {
  error: string;
  code?: string;
  hints?: string[];
}

const generateRequestId = () => {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export default function ConsentWithdrawalModal({
  isOpen,
  onClose,
}: ConsentWithdrawalModalProps) {
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
  const [acknowledged, setAcknowledged] = useState(false);
  const [state, setState] = useState<ModalState>("idle");
  const [error, setError] = useState<ApiError | null>(null);
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
    setAcknowledged(false);
    setState("idle");
    setError(null);
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

  const canSubmit = isAuth ? (acknowledged && state !== "loading") : (
    name.trim().length >= 2 &&
    phone.replace(/\D/g, "").length >= 8 &&
    acknowledged &&
    (siteKey ? !!token : true) &&
    state !== "loading"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setState("loading");
    setError(null);

    try {
      const res = await fetch("/api/consents/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: isAuth ? undefined : name.trim(),
          phone: isAuth ? undefined : phone,
          email: isAuth ? undefined : (email.trim() || undefined),
          consentAcknowledged: acknowledged,
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

      if (res.status === 202) {
        const payload = (await res.json()) as ApiError;
        setError(payload);
        setState("already-processed");
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

      setState("success");
    } catch (err) {
      clientLog.error("Consent withdraw failed", err);
      setError({
        error: t('gdpr.networkError'),
        code: "NETWORK_ERROR",
      });
      setState("error");
      resetTurnstile();
      setRequestId(generateRequestId());
    }
  }

  const showHints = !!(error?.hints && error.hints.length > 0);
  const isLoading = state === "loading";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdraw-modal-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="withdraw-modal-title" className="text-xl font-semibold text-foreground">
              {t('gdpr.withdraw.title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
               {t('gdpr.withdraw.subtitle')}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted"
            aria-label={t('gdpr.withdraw.close')}
          >
            ×
          </button>
        </div>

        {state === "success" ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-100">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <span aria-hidden="true">✓</span>
                {t('gdpr.withdraw.successTitle')}
              </h3>
              <p className="mt-2 text-sm">
                {t('gdpr.withdraw.successMessage')}
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="font-medium">{t('gdpr.withdraw.whatItMeans')}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-left">
                    <li>{t('gdpr.withdraw.noNewBookings')}</li>
                    <li>{t('gdpr.withdraw.essentialDataKept')}</li>
                    <li>{t('gdpr.withdraw.futureConsentNeeded')}</li>
                  </ul>
                </div>
                <p>{t('gdpr.withdraw.eraseDataHint')}</p>
                <p>{t('gdpr.withdraw.thankYou')}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="btn btn-primary flex-1" onClick={handleClose}>
                {t('gdpr.withdraw.close')}
              </button>
            </div>
          </div>
        ) : state === "already-processed" ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-100">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <span aria-hidden="true">ℹ</span>
                {t('gdpr.withdraw.alreadyProcessedTitle')}
              </h3>
              <p className="mt-2 text-sm">
                {t('gdpr.withdraw.alreadyProcessedMessage')}
              </p>
              {showHints && error?.hints?.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                  {error.hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="btn btn-primary flex-1" onClick={handleClose}>
                {t('gdpr.withdraw.close')}
              </button>
            </div>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            {!isAuth && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="withdraw-name">
                  {t('form.name')}
                </label>
                  <input
                    id="withdraw-name"
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
                  <label className="text-sm font-medium text-foreground" htmlFor="withdraw-phone">
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
                  <label className="text-sm font-medium text-foreground" htmlFor="withdraw-email">
                  {t('form.email')} <span className="text-xs text-muted-foreground">({t('gdpr.export.emailOptional')})</span>
                  </label>
                  <input
                    id="withdraw-email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder={t('gdpr.export.emailPlaceholder')}
                    autoComplete="email"
                  />
                </div>
              </>
            )}

            <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/25 p-4 text-sm text-card-foreground transition">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                required
              />
              <span>
                {t('gdpr.withdraw.acknowledgement')}
              </span>
            </label>

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
                {t('gdpr.withdraw.cancel')}
              </button>
              <button
                type="submit"
                className={`btn btn-primary flex-1 ${!canSubmit ? 'opacity-60 pointer-events-none' : ''}`}
                disabled={!canSubmit || isLoading}
              >
                {isLoading ? t('gdpr.withdraw.loading') : t('gdpr.withdraw.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
