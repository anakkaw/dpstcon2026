import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import { CONFERENCE_TZ } from "@/lib/conference-tz";
import { getServerTranslator } from "@/lib/i18n/server";
import {
  getConferenceInfo,
  pickLabel,
} from "@/server/conference-info-data";
import {
  getPublicProgram,
  type PublicProgramItem,
} from "@/server/public-conference-data";

export const dynamic = "force-dynamic";

export default async function ConferenceHomePage() {
  const { t, locale } = await getServerTranslator();
  const [info, programPreview] = await Promise.all([
    getConferenceInfo(),
    getPublicProgram({ limit: 3 }),
  ]);

  const welcomeMessages = [
    { imageClass: "object-[96%_28%]" },
    { imageClass: "object-[95%_30%]" },
    { imageClass: "object-[97%_34%]" },
  ];

  return (
    <div className="bg-landing-hero text-slate-100 min-h-screen flex flex-col overflow-hidden relative">
      {/* Background Decorative Glowing Orbs */}
      <div className="absolute -left-20 top-1/4 h-[450px] w-[450px] rounded-full bg-orange-500/5 blur-[100px] pointer-events-none animate-pulse-glow" />
      <div className="absolute right-1/4 top-10 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      {/* Main Conference Hero Section */}
      <section className="relative w-full py-6 lg:py-10 flex items-center border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Portal Header & Details */}
            <div className="lg:col-span-6 flex flex-col gap-4 text-left animate-slide-in-left">
              <div className="inline-flex items-center gap-2 self-start rounded-full border border-orange-500/20 bg-orange-500/10 px-3.5 py-1.5 text-xs font-semibold text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                <Sparkles className="h-3.5 w-3.5 animate-pulse text-orange-400" />
                <span>DPSTCon 2026</span>
              </div>

              <div className="space-y-2.5">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.1] text-white">
                  {t("conference.home.heading")}
                </h1>
                <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed max-w-xl">
                  {t("conference.tagline")}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mt-1">
                <Link
                  href="/conference/program"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(249,115,22,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(249,115,22,0.5)] hover:scale-[1.01]"
                >
                  {t("conference.nav.program")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/conference/abstracts"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-bold text-slate-200 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
                >
                  <Search className="h-4 w-4 text-orange-400" />
                  {t("conference.nav.abstracts")}
                </Link>
              </div>

              {/* Date & Venue Pods inside Elegant Glassmorphism Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <InfoItem
                  icon={Calendar}
                  label={locale === "en" ? "Conference date" : "วันจัดงาน"}
                  title={pickLabel(info.dateLabel, locale)}
                  glowColor="group-hover:border-orange-500/30"
                />
                <InfoItem
                  icon={MapPin}
                  label={locale === "en" ? "Venue" : "สถานที่"}
                  title={pickLabel(info.venueName, locale)}
                  desc={pickLabel(info.venueDetail, locale)}
                  glowColor="group-hover:border-cyan-500/30"
                />
              </div>
            </div>

            {/* Right Column: Hero Graphic with Smooth Radial Mask Fading */}
            <div className="lg:col-span-6 relative w-full h-[220px] sm:h-[280px] lg:h-[360px] flex items-center justify-center animate-slide-in-right">
              <div className="relative w-full h-full">
                <Image
                  src="/hero-img.png"
                  alt="DPSTCon 2026 Graphics"
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-contain object-center lg:object-right saturate-[1.15] scale-105 sm:scale-110 lg:scale-115 drop-shadow-[0_20px_40px_rgba(249,115,22,0.20)] transition-all duration-300"
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

      {/* Welcome Messages Section */}
      <section className="relative py-10 bg-slate-950/20 border-b border-white/5 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mb-6 text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400">
              {locale === "en" ? "Opening Remarks" : "สารอวยพรและต้อนรับ"}
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide mt-1">
              {locale === "en" ? "Welcome Messages" : "สารต้อนรับ"}
            </h2>
            <span className="mt-3 block h-[3px] w-12 rounded-full bg-gradient-to-r from-orange-500 to-amber-500" />
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 justify-center">
            {welcomeMessages.map((message, idx) => (
              <WelcomeMessageCard
                key={idx}
                message={message}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Program Schedule Preview Section */}
      <section className="relative py-16 bg-slate-950/40 border-b border-white/5 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mb-10 text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
              {locale === "en" ? "Event Schedule" : "กำหนดการสำคัญ"}
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide mt-1">
              {t("conference.home.scheduleTitle")}
            </h2>
            <span className="mt-3 block h-[3px] w-12 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />
          </div>

          {programPreview.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {programPreview.map((item) => (
                <ProgramPreviewItem
                  key={item.presentationId}
                  item={item}
                  locale={locale}
                  tba={t("conference.program.tba")}
                  oralLabel={t("conference.program.typeOral")}
                  posterLabel={t("conference.program.typePoster")}
                />
              ))}
            </div>
          )}

          <div className="mt-8 flex">
            <Link
              href="/conference/program"
              className="group inline-flex items-center gap-2 text-sm font-bold text-orange-400 transition-colors hover:text-orange-300"
            >
              {t("conference.home.scheduleCta")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}

function WelcomeMessageCard({
  message,
}: {
  message: {
    imageClass: string;
  };
}) {
  return (
    <article className="group flex flex-col items-center justify-center p-4 rounded-2xl border border-white/5 bg-white/2 backdrop-blur-md hover:bg-white/4 hover:border-white/10 transition-all duration-300 hover:-translate-y-1">
      <div className="relative h-28 w-28 overflow-hidden rounded-full bg-slate-900 shadow-[0_12px_28px_rgba(249,115,22,0.15)] ring-4 ring-orange-500/10 group-hover:ring-orange-500/30 transition-all duration-500 sm:h-32 sm:w-32">
        <Image
          src="/hero-img.png"
          alt="VIP Portrait"
          fill
          sizes="128px"
          className={`scale-[2.18] object-cover opacity-95 saturate-[1.10] transition-transform duration-500 group-hover:scale-[2.28] ${message.imageClass}`}
        />
        <div className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(0,0,0,0.00)_0%,rgba(2,6,23,0.35)_100%)]" />
      </div>
    </article>
  );
}

function ProgramPreviewItem({
  item,
  locale,
  tba,
  oralLabel,
  posterLabel,
}: {
  item: PublicProgramItem;
  locale: string;
  tba: string;
  oralLabel: string;
  posterLabel: string;
}) {
  const title =
    locale === "en" ? item.titleEn?.trim() || item.titleTh : item.titleTh;
  const scheduledAt = item.scheduledAt
    ? formatProgramDateTime(item.scheduledAt, locale)
    : tba;
  const typeLabel = item.type === "ORAL" ? oralLabel : posterLabel;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/2 p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/4 hover:border-white/10 hover:shadow-[0_12px_24px_rgba(249,115,22,0.08)] group">
      {/* Decorative vertical glowing line */}
      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-cyan-500 opacity-40 group-hover:opacity-100 transition-opacity" />
      
      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="text-xs font-bold text-orange-400 tracking-wide">
          {scheduledAt}
        </span>
        <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 text-xs font-extrabold text-cyan-400">
          {typeLabel}
        </span>
      </div>
      <div className="flex gap-3 text-left">
        <Clock className="mt-1 h-5 w-5 shrink-0 text-cyan-400" />
        <div>
          <h3 className="text-base font-extrabold leading-snug text-white tracking-wide">
            {title}
          </h3>
          {(item.room || item.track?.name) && (
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-400">
              {[item.room, item.track?.name].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatProgramDateTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "th-TH", {
    timeZone: CONFERENCE_TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function InfoItem({
  icon: Icon,
  label,
  title,
  desc,
  glowColor,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  title: string;
  desc?: string;
  glowColor: string;
}) {
  return (
    <div className={`group flex gap-3 p-3.5 rounded-xl border border-white/5 bg-white/2 backdrop-blur-md transition-all duration-300 hover:bg-white/4 ${glowColor}`}>
      <div className="h-9 w-9 shrink-0 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center transition-transform group-hover:scale-105">
        <Icon className="h-5 w-5 text-orange-400" />
      </div>
      <div className="min-w-0 text-left">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="mt-1 text-sm font-extrabold leading-snug text-white tracking-wide">
          {title}
        </div>
        {desc && (
          <div className="mt-1 text-xs font-medium leading-snug text-slate-400">
            {desc}
          </div>
        )}
      </div>
    </div>
  );
}
