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
    <div className="bg-[#fff1e6]">
      <section className="relative overflow-hidden border-b border-white/60 bg-[#fff1e6]">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#c2410c_0%,#f97316_36%,#f59e0b_72%,#fff7ed_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(122deg,rgba(255,122,0,0.58)_0%,rgba(255,190,77,0.46)_24%,rgba(244,63,94,0.24)_50%,rgba(37,99,235,0.12)_78%,rgba(255,247,237,0.82)_100%)]" />
        <div className="absolute -left-36 top-24 h-52 w-[78rem] -rotate-12 rounded-lg bg-[linear-gradient(90deg,rgba(194,65,12,0.40)_0%,rgba(249,115,22,0.42)_34%,rgba(251,191,36,0.32)_68%,rgba(255,255,255,0.08)_100%)] blur-2xl" />
        <div className="absolute bottom-4 right-[-18rem] h-56 w-[68rem] -rotate-12 rounded-lg bg-[linear-gradient(90deg,rgba(251,146,60,0.34)_0%,rgba(244,63,94,0.24)_42%,rgba(59,130,246,0.13)_100%)] blur-2xl" />
        <div className="absolute inset-0 opacity-[0.42] [background-image:linear-gradient(rgba(194,65,12,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(194,65,12,0.06)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] lg:block">
          <Image
            src="/hero-img.png"
            alt=""
            fill
            priority
            sizes="58vw"
            className="object-contain object-right-bottom opacity-90 saturate-125 drop-shadow-[0_32px_42px_rgba(194,65,12,0.20)]"
          />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,247,237,0.18)_0%,rgba(255,255,255,0.10)_52%,rgba(255,255,255,0.03)_100%)]" />
        <div className="pointer-events-none absolute left-0 top-20 hidden h-64 w-2 rounded-r-lg bg-[linear-gradient(180deg,#c2410c_0%,#f97316_52%,#f59e0b_100%)] lg:block" />

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-700">
              <Sparkles className="h-4 w-4" />
              DPSTCon 2026
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.1] text-ink sm:text-5xl">
              {t("conference.home.heading")}
            </h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-ink-light sm:text-lg">
              {t("conference.tagline")}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/conference/program"
                className="group inline-flex items-center justify-center gap-2 rounded-button bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-[0_14px_28px_rgb(249_115_22/0.24)] transition-all hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-[0_18px_38px_rgb(249_115_22/0.26)]"
              >
                {t("conference.nav.program")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/conference/abstracts"
                className="glass-chip inline-flex items-center justify-center gap-2 rounded-button border px-5 py-3 text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white/80"
              >
                <Search className="h-4 w-4" />
                {t("conference.nav.abstracts")}
              </Link>
            </div>
          </div>

          <div className="mt-9 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-10">
            <InfoItem
              icon={Calendar}
              label={locale === "en" ? "Conference date" : "วันจัดงาน"}
              title={pickLabel(info.dateLabel, locale)}
            />
            <InfoItem
              icon={MapPin}
              label={locale === "en" ? "Venue" : "สถานที่"}
              title={pickLabel(info.venueName, locale)}
              desc={pickLabel(info.venueDetail, locale)}
            />
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <div className="mb-10">
            <h2 className="text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
              {locale === "en" ? "Welcome Messages" : "สารต้อนรับ"}
            </h2>
            <span className="mt-3 block h-1 w-14 rounded-full bg-brand-500" />
          </div>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
            {welcomeMessages.map((message) => (
              <WelcomeMessageCard
                key={message.imageClass}
                message={message}
              />
            ))}
          </div>

        </div>
      </section>

      <section className="border-y border-brand-100/70 bg-[#fff8f1]">
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
          <div className="mb-7 flex flex-col gap-2">
            <h2 className="text-3xl font-extrabold leading-tight text-ink">
              {t("conference.home.scheduleTitle")}
            </h2>
            <span className="mt-1 block h-1 w-14 rounded-full bg-brand-500" />
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

          <Link
            href="/conference/program"
            className="mt-7 inline-flex items-center gap-2 text-sm font-extrabold text-brand-700 transition-colors hover:text-brand-800"
          >
            {t("conference.home.scheduleCta")}
            <ArrowRight className="h-4 w-4" />
          </Link>
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
    <article className="group flex justify-center">
      <div className="relative h-40 w-40 overflow-hidden rounded-full bg-brand-50 shadow-[0_22px_50px_rgb(194_65_12/0.16)] ring-8 ring-brand-50/80 sm:h-44 sm:w-44">
        <Image
          src="/hero-img.png"
          alt=""
          fill
          sizes="176px"
          className={`scale-[2.18] object-cover opacity-95 saturate-125 transition-transform duration-500 group-hover:scale-[2.30] ${message.imageClass}`}
        />
        <div className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,247,237,0.00)_0%,rgba(255,247,237,0.28)_100%)]" />
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
    <div className="relative rounded-lg border border-brand-100 bg-white/72 p-5 shadow-elev-1">
      <div className="mb-5 flex items-center justify-between gap-4">
        <span className="text-xs font-extrabold text-brand-700">
          {scheduledAt}
        </span>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-extrabold text-brand-700">
          {typeLabel}
        </span>
      </div>
      <div className="flex gap-3">
        <Clock className="mt-1 h-5 w-5 shrink-0 text-brand-600" />
        <div>
          <h3 className="text-lg font-extrabold leading-snug text-ink">
            {title}
          </h3>
          {(item.room || item.track?.name) && (
            <p className="mt-2 text-sm font-medium leading-relaxed text-ink-muted">
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
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="group flex gap-3">
      <Icon className="mt-1 h-5 w-5 shrink-0 text-brand-600 transition-colors group-hover:text-brand-700" />
      <div className="min-w-0">
        <div className="text-xs font-extrabold text-brand-700">{label}</div>
        <div className="mt-1 text-lg font-extrabold leading-snug text-ink sm:text-xl">
          {title}
        </div>
        {desc && (
          <div className="mt-1 text-sm font-medium leading-snug text-ink-muted">
            {desc}
          </div>
        )}
      </div>
    </div>
  );
}
