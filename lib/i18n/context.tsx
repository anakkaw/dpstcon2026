"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Locale } from "./types";
import { DEFAULT_LOCALE } from "./types";
import type { TranslationKey } from "./translations/th";
import { LOCALE_COOKIE, translate } from "./shared";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    document.documentElement.lang = newLocale;
    document.cookie = [
      `${LOCALE_COOKIE}=${newLocale}`,
      "Path=/",
      "Max-Age=31536000",
      "SameSite=Lax",
      window.location.protocol === "https:" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      return translate(locale, key, params);
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
