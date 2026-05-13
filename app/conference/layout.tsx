import Link from "next/link";
import { LanguageToggle } from "@/components/language-toggle";
import { Footer } from "@/components/ui/footer";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function ConferenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = await getServerTranslator();

  const navLinks = [
    { href: "/conference", label: t("conference.nav.home") },
    { href: "/conference/program", label: t("conference.nav.program") },
    {
      href: "/conference/abstracts",
      label: t("conference.nav.abstracts"),
    },
    { href: "/conference/docs", label: t("conference.nav.documents") },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface-1">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 py-3.5">
          <Link href="/conference" className="flex items-center gap-3 shrink-0 group">
            <div className="h-10 w-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-elev-2 group-hover:shadow-elev-3 transition-shadow">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <div className="leading-tight">
              <div className="font-bold text-base text-ink">
                {t("conference.title")}
              </div>
              <div className="text-[11px] text-ink-muted hidden sm:block">
                {t("conference.tagline")}
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-2 rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-ink-muted border border-border hover:bg-surface-2 hover:text-ink transition-colors"
            >
              {t("common.signIn")}
            </Link>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2 border-t border-border-light">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink rounded-md"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <Footer
        developedBy={t("footer.developedBy")}
        university={t("footer.university")}
      />
    </div>
  );
}
