import "server-only";

import { cookies } from "next/headers";
import type { Locale } from "./types";
import { normalizeLocale, LOCALE_COOKIE, translate } from "./shared";
import type { TranslationKey } from "./translations/th";

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}

export async function getServerTranslator() {
  const locale = await getServerLocale();

  return {
    locale,
    t: (
      key: TranslationKey,
      params?: Record<string, string | number>
    ) => translate(locale, key, params),
  };
}
