import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/server";

const COPY = {
  en: {
    title: "Page not found",
    description:
      "The link may be incorrect, or the page you are looking for has been moved.",
    home: "Back to home",
    dashboard: "Go to dashboard",
  },
  th: {
    title: "ไม่พบหน้าที่ต้องการ",
    description:
      "ลิงก์อาจไม่ถูกต้อง หรือหน้าที่คุณต้องการถูกย้ายออกจากระบบแล้ว",
    home: "กลับหน้าแรก",
    dashboard: "ไปที่แดชบอร์ด",
  },
} as const;

export default async function NotFound() {
  const locale = await getServerLocale();
  const copy = COPY[locale];

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">
        404
      </p>
      <h1 className="mt-3 text-3xl font-bold text-ink">{copy.title}</h1>
      <p className="mt-3 text-sm text-ink-muted">{copy.description}</p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          {copy.home}
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
        >
          {copy.dashboard}
        </Link>
      </div>
    </div>
  );
}
