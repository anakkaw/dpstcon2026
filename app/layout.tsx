import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-dpst-body",
});

export const metadata: Metadata = {
  title: "DPSTCon — Submission Management System",
  description:
    "ระบบบริหารการส่งและพิจารณาบทความ DPSTCon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${notoSansThai.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <I18nProvider>
          {children}
        </I18nProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Auto-recover from ChunkLoadError by reloading the page
              window.addEventListener('error', function(e) {
                if (e.message && (e.message.includes('ChunkLoadError') || e.message.includes('Loading chunk'))) {
                  console.warn('[DPSTCon] Chunk load error detected, reloading...');
                  window.location.reload();
                }
              });
              window.addEventListener('unhandledrejection', function(e) {
                var reason = e.reason && (e.reason.message || String(e.reason));
                if (reason && (reason.includes('ChunkLoadError') || reason.includes('Loading chunk') || reason.includes('Failed to fetch dynamically'))) {
                  console.warn('[DPSTCon] Chunk load rejection detected, reloading...');
                  window.location.reload();
                }
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
