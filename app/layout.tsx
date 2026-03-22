import type { Metadata } from "next";
import { Geist, Prompt, Sarabun } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DPSTCon — Conference Management System",
  description:
    "ระบบบริหารการพิจารณาบทความสำหรับการประชุมวิชาการ DPSTCon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${geistSans.variable} ${prompt.variable} ${sarabun.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <I18nProvider>
        {children}
        </I18nProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Auto-recover from ChunkLoadError by reloading the page
              window.addEventListener('error', function(e) {
                if (e.message && (e.message.includes('ChunkLoadError') || e.message.includes('Loading chunk') || e.message.includes('Failed to fetch'))) {
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
