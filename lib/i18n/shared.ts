import type { Locale } from "./types";
import { DEFAULT_LOCALE } from "./types";
import th from "./translations/th";
import en from "./translations/en";
import type { TranslationKey } from "./translations/th";

export const LOCALE_COOKIE = "dpstcon-locale";

export const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  th,
  en,
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "th" || value === "en";
}

export function normalizeLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  let text =
    dictionaries[locale][key] ||
    dictionaries[DEFAULT_LOCALE][key] ||
    key;

  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replace(
        new RegExp(`\\{${paramKey}\\}`, "g"),
        String(paramValue)
      );
    }
  }

  return text;
}
