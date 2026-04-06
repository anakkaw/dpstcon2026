import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import Script from "next/script";
import { I18nProvider } from "@/lib/i18n";
import { getServerLocale, getServerTranslator } from "@/lib/i18n/server";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-dpst-body",
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
    <html lang={locale} className={`${notoSansThai.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <I18nProvider initialLocale={locale}>
          {children}
        </I18nProvider>
        <Script id="chunk-recovery" strategy="afterInteractive">
          {`
            window.addEventListener("error", function (event) {
              if (
                event.message &&
                (event.message.includes("ChunkLoadError") ||
                  event.message.includes("Loading chunk"))
              ) {
                console.warn("[DPSTCon] Chunk load error detected, reloading...");
                window.location.reload();
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
                console.warn("[DPSTCon] Chunk load rejection detected, reloading...");
                window.location.reload();
              }
            });
          `}
        </Script>
      </body>
    </html>
  );
}
