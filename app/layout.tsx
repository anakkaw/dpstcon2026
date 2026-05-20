import type { Metadata } from "next";
import Script from "next/script";
import { Prompt, Sarabun } from "next/font/google";
import clsx from "clsx";
import { I18nProvider } from "@/lib/i18n";
import { getServerLocale, getServerTranslator } from "@/lib/i18n/server";
import "./globals.css";

const sarabun = Sarabun({
  subsets: ["latin", "thai"],
  display: "swap",
  variable: "--font-dpst-body",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800"],
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "Segoe UI",
    "Tahoma",
    "Leelawadee UI",
    "sans-serif",
  ],
});

const prompt = Prompt({
  subsets: ["latin", "thai"],
  display: "swap",
  variable: "--font-dpst-title",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "Segoe UI",
    "Tahoma",
    "Leelawadee UI",
    "sans-serif",
  ],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();

  return {
    title: "DPSTCon — Submission Management System",
    description: `DPSTCon — ${t("app.description")}`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();

  return (
    <html lang={locale} className={clsx("h-full", sarabun.variable, prompt.variable)}>
      <body className="min-h-full flex flex-col antialiased">
        <I18nProvider initialLocale={locale}>
          {children}
        </I18nProvider>
        <Script id="chunk-recovery" strategy="afterInteractive">
          {`
            (function () {
              if (window.__dpstChunkRecoveryInstalled) return;
              window.__dpstChunkRecoveryInstalled = true;

              var recoveryKey = "dpstcon:chunk-recovery:last-reload";
              var recoveryCooldownMs = 30000;

              function recoverFromChunkError(source) {
                try {
                  var lastReloadAt = Number(sessionStorage.getItem(recoveryKey) || "0");
                  var now = Date.now();

                  if (now - lastReloadAt < recoveryCooldownMs) {
                    console.warn("[DPSTCon] Chunk load " + source + " repeated, reload skipped.");
                    return;
                  }

                  sessionStorage.setItem(recoveryKey, String(now));
                } catch (error) {
                  console.warn("[DPSTCon] Chunk recovery storage unavailable.", error);
                }

                console.warn("[DPSTCon] Chunk load " + source + " detected, reloading...");
                window.location.reload();
              }

              window.addEventListener("error", function (event) {
                if (
                  event.message &&
                  (event.message.includes("ChunkLoadError") ||
                    event.message.includes("Loading chunk"))
                ) {
                  recoverFromChunkError("error");
                }
              });

              window.addEventListener("unhandledrejection", function (event) {
                var reason = event.reason && (event.reason.message || String(event.reason));
                if (
                  reason &&
                  (reason.includes("ChunkLoadError") ||
                    reason.includes("Loading chunk") ||
                    reason.includes("Failed to fetch dynamically"))
                ) {
                  recoverFromChunkError("rejection");
                }
              });
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
