import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  Files,
  LogIn,
  Sparkles,
} from "lucide-react";
import { getServerTranslator } from "@/lib/i18n/server";
import { LanguageToggle } from "@/components/language-toggle";
import { Footer } from "@/components/ui/footer";
import { Countdown } from "@/components/countdown";

export default async function HomePage() {
  const { t, locale } = await getServerTranslator();

  const publicLinks = [
    {
      href: "/conference",
      icon: Sparkles,
      title: locale === "en" ? "Public Conference Home" : "หน้าหลักงานประชุม",
      desc:
        locale === "en"
          ? "Start with the public overview, key dates, venue, and featured conference content."
          : "เริ่มจากภาพรวมสาธารณะ วันเวลา สถานที่ และข้อมูลเด่นของงานประชุม",
      glowColor: "group-hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]",
      iconBg: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      accent: "bg-orange-500",
      hover: "hover:border-orange-500/30",
    },
    {
      href: "/conference/program",
      icon: CalendarDays,
      title: t("conference.nav.program"),
      desc:
        locale === "en"
          ? "Browse oral and poster presentation sessions in one place."
          : "ดูตารางนำเสนอผลงานทั้งแบบบรรยายและโปสเตอร์ในหน้าเดียว",
      glowColor: "group-hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      iconBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      accent: "bg-cyan-500",
      hover: "hover:border-cyan-500/30",
    },
    {
      href: "/conference/abstracts",
      icon: FileText,
      title: t("conference.nav.abstracts"),
      desc:
        locale === "en"
          ? "Search published abstracts by title, author, keywords, or paper code."
          : "ค้นหาบทคัดย่อที่เผยแพร่ด้วยชื่อเรื่อง ผู้แต่ง คำสำคัญ หรือรหัสบทความ",
      glowColor: "group-hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      iconBg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      accent: "bg-purple-500",
      hover: "hover:border-purple-500/30",
    },
    {
      href: "/conference/docs",
      icon: Files,
      title: t("conference.nav.documents"),
      desc:
        locale === "en"
          ? "Download public conference files and supporting documents."
          : "ดาวน์โหลดเอกสารเผยแพร่และไฟล์ประกอบงานประชุม",
      glowColor: "group-hover:shadow-[0_0_20px_rgba(239,68,68,0.15)]",
      iconBg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      accent: "bg-rose-500",
      hover: "hover:border-rose-500/30",
    },
  ];

  return (
    <div className="min-h-screen bg-landing-hero text-slate-100 flex flex-col overflow-hidden">
      {/* Background Decorative Glowing Orbs */}
      <div className="absolute -left-20 top-1/4 h-[400px] w-[400px] rounded-full bg-orange-500/5 blur-[100px] pointer-events-none animate-pulse-glow" />
      <div className="absolute right-1/4 top-10 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      {/* Floating minimalist glass header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-slate-950/20 border-b border-white/5 transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3 group">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#fb923c_0%,#f97316_52%,#c2410c_100%)] shadow-[0_0_15px_rgba(249,115,22,0.25)] group-hover:scale-105 transition-transform duration-300">
              <span className="text-lg font-bold text-white tracking-wide">D</span>
            </span>
            <span className="min-w-0">
              <span className="block text-base font-extrabold leading-tight text-white tracking-wide">
                DPSTCon 2026
              </span>
              <span className="hidden text-[10px] uppercase font-bold tracking-widest text-slate-400 leading-tight sm:block">
                {t("landing.title")}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <LanguageToggle className="text-slate-300 hover:text-white border-white/10 hover:bg-white/5 bg-white/3" />
            <Link
              href="/login"
              className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 transition-all hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              <LogIn className="h-3.5 w-3.5" />
              {t("common.signIn")}
            </Link>
          </div>
        </div>
      </header>

      {/* Immersive Hero Section */}
      <main className="flex-grow flex flex-col justify-center relative">
        <section className="relative w-full py-12 lg:py-20 flex items-center">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              
              {/* Left Column: Hero Text & Call to Actions */}
              <div className="lg:col-span-6 flex flex-col gap-6 text-left animate-slide-in-left">
                <div className="inline-flex items-center gap-2 self-start rounded-full border border-orange-500/20 bg-orange-500/10 px-3.5 py-1.5 text-xs font-semibold text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse text-orange-400" />
                  <span>
                    {locale === "en" ? "Official Conference Portal" : "พื้นที่พอร์ทัลงานประชุมวิชาการ พสวท."}
                  </span>
                </div>

                <div className="space-y-4">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-white">
                    DPSTCon{" "}
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-amber-300 to-rose-400 drop-shadow-[0_0_30px_rgba(249,115,22,0.2)]">
                      2026
                    </span>
                  </h1>
                  <p className="text-lg sm:text-xl text-slate-300 font-medium leading-relaxed max-w-xl">
                    {t("landing.subtitle")}
                  </p>
                  <p className="text-sm font-bold tracking-wide text-slate-400 max-w-xl uppercase">
                    {t("conference.tagline")}
                  </p>
                </div>

                {/* Primary & Secondary Actions */}
                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                  <Link
                    href="/conference"
                    className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(249,115,22,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(249,115,22,0.5)] hover:scale-[1.01]"
                  >
                    {locale === "en" ? "Explore Public Portal" : "เข้าสู่หน้าพอร์ทัลสาธารณะ"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-bold text-slate-200 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
                  >
                    <LogIn className="h-4 w-4" />
                    {t("common.signIn")}
                  </Link>
                </div>

                {/* Highly-integrated Countdown Timer */}
                <div className="mt-4">
                  <Countdown locale={locale} />
                </div>
              </div>

              {/* Right Column: Hero Graphic with Smooth Radial Mask Fading */}
              <div className="lg:col-span-6 relative w-full h-[340px] sm:h-[420px] lg:h-[520px] flex items-center justify-center animate-slide-in-right">
                <div className="relative w-full h-full">
                  <Image
                    src="/hero-img.png"
                    alt="DPSTCon 2026 Portal"
                    fill
                    priority
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-contain object-center lg:object-right saturate-[1.15] scale-110 sm:scale-115 lg:scale-120 drop-shadow-[0_20px_40px_rgba(249,115,22,0.20)] transition-all duration-300"
                    style={{
                      maskImage: "radial-gradient(circle at center, black 50%, transparent 88%)",
                      WebkitMaskImage: "radial-gradient(circle at center, black 50%, transparent 88%)",
                    }}
                  />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Bento Grid Access Cards */}
        <section className="relative py-14 bg-slate-950/20 border-t border-white/5 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-col gap-1.5 text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400">
                {locale === "en" ? "Conference Access" : "ทางเข้าข้อมูลสำคัญ"}
              </p>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                {locale === "en"
                  ? "Select Public Resource"
                  : "เลือกช่องทางเข้าถึงข้อมูลสาธารณะ"}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {publicLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative overflow-hidden rounded-2xl border border-white/5 bg-white/2 p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/5 hover:border-white/12 ${item.glowColor} ${item.hover}`}
                >
                  {/* Decorative glowing top line */}
                  <span className={`absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl transition-all opacity-40 group-hover:opacity-100 ${item.accent}`} />
                  
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${item.iconBg} transition-transform group-hover:scale-105 duration-300`}
                    >
                      <item.icon className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition-all duration-300 group-hover:translate-x-1.5 group-hover:text-white" />
                  </div>
                  
                  <h3 className="text-base font-extrabold leading-snug text-white tracking-wide">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400 group-hover:text-slate-300 transition-colors">
                    {item.desc}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer
        developedBy={t("footer.developedBy")}
        university={t("footer.university")}
        variant="dark"
        className="bg-slate-950/40 border-t border-white/5 text-slate-500 py-6"
      />
    </div>
  );
}
