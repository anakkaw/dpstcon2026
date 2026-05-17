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

export default async function HomePage() {
  const { t, locale } = await getServerTranslator();

  const publicLinks = [
    {
      href: "/conference",
      icon: Sparkles,
      title: locale === "en" ? "Public conference home" : "หน้า public งานประชุม",
      desc:
        locale === "en"
          ? "Start with the public overview, key dates, venue, and featured conference content."
          : "เริ่มจากภาพรวมสาธารณะ วันเวลา สถานที่ และข้อมูลเด่นของงานประชุม",
      iconBg: "glass-chip text-brand-700",
      accent: "bg-brand-500",
      hover: "hover:border-brand-200",
    },
    {
      href: "/conference/program",
      icon: CalendarDays,
      title: t("conference.nav.program"),
      desc:
        locale === "en"
          ? "Browse oral and poster presentation sessions in one place."
          : "ดูตารางนำเสนอผลงานทั้งแบบบรรยายและโปสเตอร์ในหน้าเดียว",
      iconBg: "glass-chip text-brand-700",
      accent: "bg-amber-500",
      hover: "hover:border-brand-200",
    },
    {
      href: "/conference/abstracts",
      icon: FileText,
      title: t("conference.nav.abstracts"),
      desc:
        locale === "en"
          ? "Search published abstracts by title, author, keywords, or paper code."
          : "ค้นหาบทคัดย่อที่เผยแพร่ด้วยชื่อเรื่อง ผู้แต่ง คำสำคัญ หรือรหัสบทความ",
      iconBg: "glass-chip text-brand-700",
      accent: "bg-orange-400",
      hover: "hover:border-brand-200",
    },
    {
      href: "/conference/docs",
      icon: Files,
      title: t("conference.nav.documents"),
      desc:
        locale === "en"
          ? "Download public conference files and supporting documents."
          : "ดาวน์โหลดเอกสารเผยแพร่และไฟล์ประกอบงานประชุม",
      iconBg: "glass-chip text-amber-700",
      accent: "bg-brand-600",
      hover: "hover:border-amber-200",
    },
  ];

  return (
    <div className="min-h-screen bg-[#fff1e6] text-ink">
      <header className="glass-nav relative z-20 border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#fb923c_0%,#f97316_52%,#c2410c_100%)] shadow-elev-2">
              <span className="text-lg font-bold text-white">D</span>
            </span>
            <span className="min-w-0">
              <span className="block text-base font-bold leading-tight text-ink">
                DPSTCon 2026
              </span>
              <span className="hidden text-xs leading-tight text-ink-muted sm:block">
                {t("landing.title")}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link
              href="/login"
              className="glass-chip hidden items-center gap-1.5 rounded-button border px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-white/80 sm:inline-flex"
            >
              <LogIn className="h-4 w-4" />
              {t("common.signIn")}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-white/60 bg-[#fff1e6]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#c2410c_0%,#f97316_36%,#f59e0b_72%,#fff7ed_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(122deg,rgba(255,122,0,0.58)_0%,rgba(255,190,77,0.46)_24%,rgba(244,63,94,0.26)_50%,rgba(37,99,235,0.15)_78%,rgba(255,247,237,0.82)_100%)]" />
          <div className="absolute -left-32 top-20 h-48 w-[76rem] -rotate-12 rounded-lg bg-[linear-gradient(90deg,rgba(194,65,12,0.40)_0%,rgba(249,115,22,0.44)_34%,rgba(251,191,36,0.34)_68%,rgba(255,255,255,0.12)_100%)] blur-2xl" />
          <div className="absolute bottom-6 right-[-18rem] h-56 w-[68rem] rotate-[-18deg] rounded-lg bg-[linear-gradient(90deg,rgba(251,146,60,0.38)_0%,rgba(244,63,94,0.26)_42%,rgba(59,130,246,0.16)_100%)] blur-2xl" />
          <div className="absolute left-6 top-32 h-64 w-[32rem] -rotate-6 rounded-lg bg-[linear-gradient(135deg,rgba(234,88,12,0.48)_0%,rgba(251,191,36,0.34)_52%,rgba(244,63,94,0.20)_100%)] blur-xl sm:left-12 lg:left-20" />
          <div className="absolute inset-0 opacity-[0.45] [background-image:linear-gradient(rgba(194,65,12,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(194,65,12,0.07)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div className="absolute left-0 top-20 hidden h-72 w-2 rounded-r-lg bg-[linear-gradient(180deg,#c2410c_0%,#f97316_52%,#f59e0b_100%)] lg:block" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-full opacity-25 sm:opacity-35 lg:w-[72%] lg:opacity-90">
            <Image
              src="/hero-img.png"
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 72vw, 100vw"
              className="object-contain object-right-bottom saturate-125"
            />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,247,237,0.22)_0%,rgba(255,255,255,0.14)_44%,rgba(255,255,255,0.03)_100%)]" />
          <div className="pointer-events-none absolute bottom-8 left-[48%] hidden h-16 w-16 rotate-6 rounded-lg border border-white/70 bg-white/35 shadow-[0_18px_60px_rgb(194_65_12/0.14)] backdrop-blur-xl lg:block" />
          <div className="pointer-events-none absolute right-[32%] top-16 hidden h-12 w-12 -rotate-6 rounded-lg border border-white/70 bg-white/35 shadow-[0_18px_60px_rgb(245_158_11/0.16)] backdrop-blur-xl lg:block" />

          <div className="relative mx-auto flex min-h-[560px] max-w-7xl items-center px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="glass-panel-strong max-w-2xl rounded-lg border p-6 sm:p-8">
              <div className="glass-chip mb-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold text-brand-700">
                <Sparkles className="h-4 w-4" />
                {locale === "en"
                  ? "Public Conference Portal"
                  : "พื้นที่สาธารณะงานประชุม"}
              </div>

              <h1 className="text-5xl font-extrabold leading-[1.04] text-ink">
                DPSTCon 2026
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-light">
                {t("landing.subtitle")}
              </p>
              <p className="mt-2 text-sm font-medium text-ink-muted">
                {t("conference.tagline")}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/conference"
                  className="group inline-flex items-center justify-center gap-2 rounded-button bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-[0_14px_28px_rgb(249_115_22/0.24)] transition-all hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-[0_18px_38px_rgb(249_115_22/0.26)]"
                >
                  {locale === "en" ? "Open public site" : "เข้าสู่หน้า public"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/login"
                  className="glass-chip inline-flex items-center justify-center gap-2 rounded-button border px-5 py-3 text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white/80"
                >
                  <LogIn className="h-4 w-4" />
                  {t("common.signIn")}
                </Link>
              </div>

              <div className="mt-8 grid max-w-xl grid-cols-3 gap-2">
                <MiniFact
                  value="2026"
                  label="DPSTCon"
                  accent="bg-brand-500"
                />
                <MiniFact
                  value={locale === "en" ? "Public" : "สาธารณะ"}
                  label={locale === "en" ? "Portal" : "หน้าเว็บ"}
                  accent="bg-amber-500"
                />
                <MiniFact
                  value={locale === "en" ? "TH / EN" : "ไทย / EN"}
                  label={locale === "en" ? "Language" : "ภาษา"}
                  accent="bg-brand-600"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#fff1e6]">
          <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,247,237,0.86)_0%,rgba(255,190,77,0.34)_38%,rgba(249,115,22,0.30)_62%,rgba(255,255,255,0.78)_100%)]" />
          <div className="absolute left-[5%] top-28 h-32 w-[90%] -rotate-2 rounded-lg bg-[linear-gradient(90deg,rgba(234,88,12,0.22)_0%,rgba(251,191,36,0.32)_34%,rgba(244,63,94,0.20)_68%,rgba(255,255,255,0.08)_100%)] blur-xl" />
          <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(120deg,rgba(255,255,255,0.72)_0_1px,transparent_1px_18px)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="mb-7 flex flex-col gap-2">
              <p className="text-sm font-bold text-brand-700">
                {locale === "en" ? "Conference access" : "ทางเข้าสำคัญ"}
              </p>
              <h2 className="text-2xl font-bold text-ink">
                {locale === "en"
                  ? "Choose the public information you need"
                  : "เลือกข้อมูลสาธารณะที่ต้องการดู"}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {publicLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`glass-panel group flex min-h-44 flex-col overflow-hidden rounded-lg border p-5 transition-all hover:-translate-y-1 hover:bg-white/72 hover:shadow-[0_24px_70px_rgb(194_65_12/0.14)] ${item.hover}`}
                >
                  <span className={`mb-4 h-1 w-16 rounded-full ${item.accent}`} />
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border ${item.iconBg}`}
                    >
                      <item.icon className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-ink-muted transition-all group-hover:translate-x-0.5 group-hover:text-brand-600" />
                  </div>
                  <h3 className="text-base font-bold leading-snug text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
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
      />
    </div>
  );
}

function MiniFact({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <div className="glass-panel overflow-hidden rounded-lg border">
      <div className={`h-1 ${accent}`} />
      <div className="px-3 py-3">
        <div className="text-base font-extrabold leading-none text-ink">
          {value}
        </div>
        <div className="mt-1 text-xs font-medium text-ink-muted">{label}</div>
      </div>
    </div>
  );
}
