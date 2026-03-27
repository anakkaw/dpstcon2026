import { type ClassValue, clsx } from "clsx";

// Lightweight cn() without tailwind-merge for better bundle size
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: Date | string | null | undefined, locale?: string): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const loc = locale === "en" ? "en-US" : "th-TH";
  return d.toLocaleDateString(loc, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined, locale?: string): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const loc = locale === "en" ? "en-US" : "th-TH";
  return d.toLocaleDateString(loc, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateTimeLocalValue(
  date: Date | string | null | undefined
): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";

  const pad = (value: number) => value.toString().padStart(2, "0");

  return [
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  ].join("T");
}

export function formatRelativeTime(date: Date | string, locale?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  const isEn = locale === "en";
  if (diffMin < 1) return isEn ? "Just now" : "เมื่อสักครู่";
  if (diffMin < 60) return isEn ? `${diffMin} minutes ago` : `${diffMin} นาทีที่แล้ว`;
  if (diffHr < 24) return isEn ? `${diffHr} hours ago` : `${diffHr} ชั่วโมงที่แล้ว`;
  if (diffDay < 7) return isEn ? `${diffDay} days ago` : `${diffDay} วันที่แล้ว`;
  return formatDate(d, locale);
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + "…";
}
