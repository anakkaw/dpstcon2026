import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  FileText,
  Files,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import { getServerTranslator } from "@/lib/i18n/server";
import {
  getPublicAbstractCount,
  getPublicProgramCount,
  getPublicTracks,
  getWelcomeDocument,
} from "@/server/public-conference-data";
import {
  getConferenceInfo,
  pickLabel,
} from "@/server/conference-info-data";
import { Card, CardBody } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ConferenceHomePage() {
  const { t, locale } = await getServerTranslator();
  const [welcome, abstractCount, programCount, tracks, info] = await Promise.all([
    getWelcomeDocument(),
    getPublicAbstractCount(),
    getPublicProgramCount(),
    getPublicTracks(),
    getConferenceInfo(),
  ]);

  const stats = {
    abstracts: abstractCount,
    tracks: tracks.length,
    sessions: programCount,
  };

  const welcomeTitle =
    welcome && locale === "en" && welcome.nameEn
      ? welcome.nameEn
      : welcome?.nameTh;
  const welcomeDesc =
    welcome && locale === "en" && welcome.descriptionEn
      ? welcome.descriptionEn
      : welcome?.descriptionTh;

  const sections = [
    {
      href: "/conference/program",
      icon: Calendar,
      title: t("conference.home.programCard"),
      desc: t("conference.home.programCardDesc"),
      iconBg: "bg-brand-50 text-brand-600",
      accent: "brand" as const,
      count: stats.sessions,
      countLabel: locale === "en" ? "Sessions" : "เซสชัน",
    },
    {
      href: "/conference/abstracts",
      icon: FileText,
      title: t("conference.home.abstractsCard"),
      desc: t("conference.home.abstractsCardDesc"),
      iconBg: "bg-blue-50 text-blue-600",
      accent: "info" as const,
      count: stats.abstracts,
      countLabel: locale === "en" ? "Papers" : "บทคัดย่อ",
    },
    {
      href: "/conference/docs",
      icon: Files,
      title: t("conference.home.documentsCard"),
      desc: t("conference.home.documentsCardDesc"),
      iconBg: "bg-emerald-50 text-emerald-600",
      accent: "success" as const,
      count: null,
      countLabel: locale === "en" ? "Downloads" : "ดาวน์โหลด",
    },
  ];

  return (
    <div>
      {/* ─── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-white">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-32 -right-24 w-[480px] h-[480px] bg-orb-brand opacity-30 blur-2xl" />
          <div className="absolute top-40 -left-32 w-[360px] h-[360px] bg-orb-brand opacity-15 blur-2xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-100 mb-6">
                <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                <span className="text-xs font-semibold text-brand-700">
                  DPSTCon 2026
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-ink leading-[1.1] tracking-tight">
                {t("conference.home.heading")}
              </h1>
              <p className="mt-5 text-base sm:text-lg text-ink-muted leading-relaxed max-w-xl">
                {t("conference.tagline")}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/conference/program"
                  className="group inline-flex items-center gap-2 bg-brand-gradient-btn text-white px-5 py-3 rounded-button text-sm font-semibold shadow-elev-2 hover:shadow-elev-3 transition-shadow"
                >
                  {t("conference.nav.program")}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  href="/conference/abstracts"
                  className="inline-flex items-center gap-2 bg-white text-ink border border-border px-5 py-3 rounded-button text-sm font-semibold hover:bg-surface-2 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  {t("conference.nav.abstracts")}
                </Link>
              </div>
            </div>

            {/* Meta card */}
            <aside className="lg:col-span-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stat-brand rounded-card border border-brand-100 p-5">
                  <div className="flex items-center gap-2 text-brand-700">
                    <Calendar className="h-4 w-4" />
                    <span className="text-[11px] uppercase tracking-wide font-semibold">
                      Date
                    </span>
                  </div>
                  <div className="mt-3 text-lg font-bold text-ink leading-tight">
                    {pickLabel(info.dateLabel, locale)}
                  </div>
                </div>
                <div className="bg-stat-info rounded-card border border-blue-100 p-5">
                  <div className="flex items-center gap-2 text-blue-700">
                    <MapPin className="h-4 w-4" />
                    <span className="text-[11px] uppercase tracking-wide font-semibold">
                      Venue
                    </span>
                  </div>
                  <div className="mt-3 text-sm font-bold text-ink leading-tight">
                    {pickLabel(info.venueName, locale)}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {pickLabel(info.venueDetail, locale)}
                  </div>
                </div>
                <div className="col-span-2 bg-white rounded-card border border-border p-5 shadow-elev-1">
                  <div className="grid grid-cols-3 gap-3 divide-x divide-border-light">
                    <Stat
                      n={stats.abstracts}
                      label={
                        locale === "en" ? "Abstracts" : "บทคัดย่อ"
                      }
                      icon={FileText}
                      color="text-brand-600"
                    />
                    <Stat
                      n={stats.tracks}
                      label={locale === "en" ? "Tracks" : "สาขาวิชา"}
                      icon={Users}
                      color="text-blue-600"
                    />
                    <Stat
                      n={stats.sessions}
                      label={
                        locale === "en" ? "Sessions" : "เซสชัน"
                      }
                      icon={Calendar}
                      color="text-emerald-600"
                    />
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ─── Welcome ──────────────────────────────────────── */}
      {welcome && (
        <section className="border-b border-border bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
              <div className="lg:col-span-4">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 uppercase tracking-wide mb-3">
                  <span className="inline-block w-6 h-px bg-brand-500" />
                  {t("conference.welcome.heading")}
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-ink leading-tight">
                  {welcomeTitle}
                </h2>
                {welcomeDesc && (
                  <p className="mt-4 text-sm text-ink-muted whitespace-pre-line leading-relaxed">
                    {welcomeDesc}
                  </p>
                )}
                <Link
                  href={`/api/public/documents/${welcome.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                  {t("conference.detail.openPdf")}{" "}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="lg:col-span-8">
                <div className="rounded-card overflow-hidden border border-border shadow-card">
                  <iframe
                    src={`/api/public/documents/${welcome.id}/file`}
                    title={welcomeTitle}
                    className="w-full h-[520px] lg:h-[640px] bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Section cards ────────────────────────────────── */}
      <section className="bg-surface-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">
                <span className="inline-block w-6 h-px bg-brand-500" />
                {locale === "en" ? "Browse" : "สำรวจ"}
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold text-ink">
                {locale === "en"
                  ? "Explore the conference"
                  : "สำรวจงานประชุม"}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sections.map((s) => (
              <Link key={s.href} href={s.href} className="group block">
                <Card hover accent={s.accent} className="h-full">
                  <CardBody className="flex flex-col gap-4 h-full">
                    <div className="flex items-start justify-between">
                      <div
                        className={`h-11 w-11 rounded-xl flex items-center justify-center ${s.iconBg}`}
                      >
                        <s.icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-ink-muted group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <h3 className="font-bold text-lg text-ink leading-snug">
                      {s.title}
                    </h3>
                    <p className="text-sm text-ink-muted flex-1">{s.desc}</p>
                    <div className="pt-3 mt-auto border-t border-border-light flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-ink tabular-nums">
                        {s.count ?? "—"}
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-ink-muted font-semibold">
                        {s.countLabel}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({
  n,
  label,
  icon: Icon,
  color,
}: {
  n: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center pl-3 first:pl-0">
      <Icon className={`h-4 w-4 ${color} mb-1.5`} />
      <div className="text-2xl font-bold text-ink tabular-nums">{n}</div>
      <div className="text-[10px] uppercase tracking-wide text-ink-muted font-semibold mt-0.5">
        {label}
      </div>
    </div>
  );
}
