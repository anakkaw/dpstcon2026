"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale, type Locale } from "@/lib/i18n";
import "./globals.css";

const COPY = {
  en: {
    eyebrow: "Application Error",
    title: "The application encountered an unexpected error",
    description:
      "Please try again. If the problem continues, contact the system administrator.",
    retry: "Try again",
  },
  th: {
    eyebrow: "Application Error",
    title: "ระบบเกิดข้อผิดพลาดที่ระดับแอปพลิเคชัน",
    description:
      "กรุณาลองใหม่อีกครั้ง หากปัญหายังเกิดซ้ำ โปรดติดต่อทีมผู้ดูแลระบบ",
    retry: "ลองใหม่อีกครั้ง",
  },
} as const;

function getClientLocale(): Locale {
  if (typeof document === "undefined") {
    return DEFAULT_LOCALE;
  }

  const cookieMatch = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`)
  );

  return normalizeLocale(cookieMatch?.[1] ?? document.documentElement.lang);
}

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    setLocale(getClientLocale());
  }, []);

  const copy = COPY[locale];

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-slate-50 text-ink antialiased">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">
            {copy.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold">{copy.title}</h1>
          <p className="mt-3 text-sm text-ink-muted">{copy.description}</p>
          <button
            onClick={() => unstable_retry()}
            className="mt-6 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            {copy.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
