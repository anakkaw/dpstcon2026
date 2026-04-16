import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { getServerTranslator } from "@/lib/i18n/server";
import { LanguageToggle } from "@/components/language-toggle";
import { Footer } from "@/components/ui/footer";

export default async function HomePage() {
  const { t } = await getServerTranslator();

  return (
    <div className="min-h-screen bg-landing-hero text-white">
      {/* ── Decorative background elements ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top-left blue glow */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blue-500/8 rounded-full blur-3xl animate-pulse-glow" />
        {/* Right orange glow */}
        <div className="absolute top-1/4 -right-20 w-[400px] h-[400px] bg-brand-500/10 rounded-full blur-3xl animate-pulse-glow [animation-delay:1.5s]" />
        {/* Bottom center glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/5 rounded-full blur-3xl" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ── Navigation Bar ── */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-elev-2">
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <span className="font-heading font-bold text-lg text-white">
            DPSTCon 2026
          </span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-sm font-medium text-white backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-all duration-300"
          >
            {t("common.signIn")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-8 sm:pt-12 lg:pt-16 pb-20 lg:pb-28">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Left — Text content */}
          <div className="flex-1 text-center lg:text-left animate-slide-in-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/15 border border-brand-500/25 mb-6">
              <Sparkles className="h-4 w-4 text-brand-400" />
              <span className="text-sm font-medium text-brand-300">
                DPST Science and Technology
              </span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight mb-4 leading-[1.1]">
              <span className="text-white">DPST</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-500">
                Con
              </span>
              <br />
              <span className="text-3xl sm:text-4xl lg:text-5xl xl:text-5xl text-slate-300 font-bold">
                2026
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-300 max-w-lg mx-auto lg:mx-0 mb-3 leading-relaxed">
              {t("landing.subtitle")}
            </p>
            <p className="text-sm text-slate-500 mb-8 lg:mb-10">
              {t("landing.title")}
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/login"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-bold text-base hover:from-brand-600 hover:to-brand-700 transition-all duration-300 shadow-xl shadow-brand-500/30 hover:shadow-2xl hover:shadow-brand-500/40 hover:-translate-y-1 active:translate-y-0"
              >
                {t("common.signIn")}
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

          </div>

          {/* Right — Mascot Image */}
          <div className="flex-1 flex justify-center lg:justify-end animate-slide-in-right">
            <div className="relative">
              {/* Glow behind image */}
              <div className="absolute inset-0 bg-brand-500/15 rounded-full blur-[80px] scale-75 animate-pulse-glow" />
              <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-[60px] scale-90 animate-pulse-glow [animation-delay:1s]" />

              {/* Mascot */}
              <Image
                src="/hero-img.png"
                alt="DPST Con 2026 Mascot"
                width={580}
                height={580}
                priority
                className="relative z-10 drop-shadow-2xl animate-float w-[320px] sm:w-[420px] lg:w-[520px] xl:w-[580px] h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      <Footer
        variant="dark"
        developedBy={t("footer.developedBy")}
        university={t("footer.university")}
      />
    </div>
  );
}
