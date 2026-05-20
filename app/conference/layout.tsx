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
    <div className="min-h-screen flex flex-col bg-landing-hero text-slate-100 relative overflow-x-hidden">
      {/* Background Decorative Glowing Orbs */}
      <div className="absolute -left-20 top-1/4 h-[450px] w-[450px] rounded-full bg-orange-500/5 blur-[100px] pointer-events-none animate-pulse-glow" />
      <div className="absolute right-1/4 top-10 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      <header className="sticky top-0 z-30 bg-slate-950/20 backdrop-blur-md border-b border-white/5 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 py-3.5">
          <Link href="/conference" className="flex items-center gap-3 shrink-0 group">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#fb923c_0%,#f97316_52%,#c2410c_100%)] shadow-[0_0_15px_rgba(249,115,22,0.25)] group-hover:scale-105 transition-transform duration-300">
              <span className="text-white font-bold text-lg">D</span>
            </span>
            <div className="leading-tight">
              <div className="font-bold text-base text-white tracking-wide">
                {t("conference.title")}
              </div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 hidden sm:block">
                {t("conference.tagline")}
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageToggle className="text-slate-300 hover:text-white border-white/10 hover:bg-white/5 bg-white/3" />
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-slate-200 border border-white/10 bg-white/5 hover:bg-white/10 hover:text-white transition-all duration-200"
            >
              {t("common.signIn")}
            </Link>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1.5 overflow-x-auto px-4 pb-2 border-t border-white/5 scrollbar-none">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-md transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1 relative z-10">{children}</main>

      <Footer
        developedBy={t("footer.developedBy")}
        university={t("footer.university")}
        variant="dark"
        className="bg-slate-950/40 border-t border-white/5 text-slate-500 py-6"
      />
    </div>
  );
}
