import Link from "next/link";
import { ArrowRight, Calendar, Clock, MapPin } from "lucide-react";
import { getServerTranslator } from "@/lib/i18n/server";
import { CONFERENCE_TZ } from "@/lib/conference-tz";
import {
  getPublicProgram,
  getPublicTracks,
  type PublicProgramItem,
} from "@/server/public-conference-data";
import { Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

type Search = { trackId?: string; type?: string };

function isPresentationType(v: string | undefined): v is "ORAL" | "POSTER" {
  return v === "ORAL" || v === "POSTER";
}

/** "YYYY-MM-DD" in conference TZ, so dates near midnight UTC don't split a day. */
function dateKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFERENCE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export default async function ConferenceProgramPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { t, locale } = await getServerTranslator();
  const params = await searchParams;

  const typeFilter = isPresentationType(params.type) ? params.type : undefined;
  const trackId = params.trackId || undefined;

  const [program, tracks] = await Promise.all([
    getPublicProgram({ trackId, type: typeFilter }),
    getPublicTracks(),
  ]);

  const days = new Map<string, PublicProgramItem[]>();
  for (const item of program) {
    if (!item.scheduledAt) continue;
    const key = dateKey(item.scheduledAt);
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(item);
  }
  const dayList = Array.from(days.entries()).sort();

  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: CONFERENCE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  function buildHref(updates: Partial<Search>) {
    const next = new URLSearchParams();
    const tid = updates.trackId !== undefined ? updates.trackId : trackId;
    const ty = updates.type !== undefined ? updates.type : typeFilter;
    if (tid) next.set("trackId", tid);
    if (ty) next.set("type", ty);
    const qs = next.toString();
    return qs ? `?${qs}` : "/conference/program";
  }

  return (
    <div>
      {/* ─── Page header ──────────────────────────────────── */}
      <section className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">
                <Calendar className="h-3.5 w-3.5" />
                {locale === "en" ? "Section 01" : "ส่วนที่ 01"}
              </div>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-ink tracking-tight">
                {t("conference.program.heading")}
              </h1>
              <p className="mt-2 text-ink-muted max-w-2xl">
                {t("conference.program.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-chip bg-stat-brand border border-brand-100 text-brand-700 font-semibold">
                <Calendar className="h-3.5 w-3.5" />
                {program.length}{" "}
                {locale === "en" ? "sessions" : "เซสชัน"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Filters (sticky chips) ───────────────────────── */}
      <section className="sticky top-[63px] sm:top-[65px] z-20 bg-white/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted w-14">
              {t("conference.program.filterType")}
            </span>
            <Chip
              href={buildHref({ type: "" })}
              active={!typeFilter}
              label={t("conference.program.allTypes")}
            />
            <Chip
              href={buildHref({ type: "ORAL" })}
              active={typeFilter === "ORAL"}
              label={t("conference.program.typeOral")}
              tone="info"
            />
            <Chip
              href={buildHref({ type: "POSTER" })}
              active={typeFilter === "POSTER"}
              label={t("conference.program.typePoster")}
              tone="success"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted w-14">
              {t("conference.program.filterTrack")}
            </span>
            <Chip
              href={buildHref({ trackId: "" })}
              active={!trackId}
              label={t("conference.program.allTracks")}
            />
            {tracks.map((tk) => (
              <Chip
                key={tk.id}
                href={buildHref({ trackId: tk.id })}
                active={trackId === tk.id}
                label={tk.name}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── Schedule ─────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {dayList.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-14 w-14" />}
            title={t("conference.program.empty")}
          />
        ) : (
          <div className="space-y-12">
            {dayList.map(([dKey, sessions], dIdx) => {
              const date = new Date(dKey);
              return (
                <section key={dKey}>
                  {/* Day header */}
                  <header className="flex items-center gap-4 mb-5">
                    <div className="flex items-baseline gap-3 px-4 py-3 rounded-card bg-brand-gradient text-white shadow-elev-2">
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-brand-100">
                        Day {dIdx + 1}
                      </div>
                      <div className="text-4xl font-extrabold leading-none tabular-nums">
                        {date.toLocaleDateString("en-GB", { day: "numeric" })}
                      </div>
                      <div className="text-sm font-semibold">
                        {date.toLocaleDateString(
                          locale === "en" ? "en-GB" : "th-TH",
                          { month: "short" }
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-ink-muted">
                      <div className="font-semibold text-ink">
                        {date.toLocaleDateString(
                          locale === "en" ? "en-GB" : "th-TH",
                          { weekday: "long" }
                        )}
                      </div>
                      <div className="text-xs">
                        {sessions.length}{" "}
                        {locale === "en" ? "sessions" : "เซสชัน"}
                      </div>
                    </div>
                  </header>

                  {/* Session rows */}
                  <div className="bg-white rounded-card border border-border shadow-elev-1 overflow-hidden divide-y divide-border-light">
                    {sessions.map((s) => (
                      <SessionRow
                        key={s.presentationId}
                        session={s}
                        time={timeFmt.format(new Date(s.scheduledAt!))}
                        locale={locale}
                        tba={t("conference.program.tba")}
                        readLabel={
                          locale === "en"
                            ? "Read abstract"
                            : "อ่านบทคัดย่อ"
                        }
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Chip({
  href,
  active,
  label,
  tone,
}: {
  href: string;
  active: boolean;
  label: string;
  tone?: "info" | "success";
}) {
  const activeClasses = active
    ? tone === "info"
      ? "bg-blue-600 text-white border-blue-600"
      : tone === "success"
      ? "bg-emerald-600 text-white border-emerald-600"
      : "bg-brand-500 text-white border-brand-500"
    : "bg-white text-ink-muted border-border hover:border-ink hover:text-ink";
  return (
    <Link
      href={href}
      className={`inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-chip transition-colors ${activeClasses}`}
    >
      {label}
    </Link>
  );
}

function SessionRow({
  session,
  time,
  locale,
  tba,
  readLabel,
}: {
  session: PublicProgramItem;
  time: string;
  locale: string;
  tba: string;
  readLabel: string;
}) {
  const title =
    locale === "en" && session.titleEn ? session.titleEn : session.titleTh;
  const presenter =
    locale === "en" && session.mainAuthorEn
      ? session.mainAuthorEn
      : session.mainAuthorTh;
  const isOral = session.type === "ORAL";
  const linkHref = session.paperCode
    ? `/conference/abstracts/${encodeURIComponent(session.paperCode)}`
    : "";

  const accentBar = isOral ? "bg-blue-500" : "bg-emerald-500";

  return (
    <div className="group relative grid grid-cols-[8px_90px_1fr_auto] sm:grid-cols-[8px_110px_1fr_160px] gap-3 sm:gap-5 items-start py-4 sm:py-5 pl-3 pr-4 sm:pr-5 hover:bg-surface-2 transition-colors">
      {/* Type accent bar */}
      <span className={`${accentBar} w-[3px] self-stretch rounded-full`} />

      {/* Time */}
      <div className="pt-0.5">
        <div className="text-xl sm:text-2xl font-bold text-ink tabular-nums leading-none flex items-baseline gap-1">
          <Clock className="h-3.5 w-3.5 text-ink-muted" />
          {time}
        </div>
        {session.duration ? (
          <div className="mt-1 text-[11px] uppercase tracking-wide font-semibold text-ink-muted tabular-nums">
            {session.duration} min
          </div>
        ) : null}
      </div>

      {/* Body */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <Badge tone={isOral ? "info" : "success"}>
            {isOral ? "Oral" : "Poster"}
          </Badge>
          {session.paperCode && (
            <span className="text-[11px] font-mono uppercase tracking-wide text-ink-muted">
              {session.paperCode}
            </span>
          )}
          {session.track?.name && (
            <>
              <span className="text-ink-muted">·</span>
              <span className="text-xs text-ink-muted">
                {session.track.name}
              </span>
            </>
          )}
        </div>
        {linkHref ? (
          <Link
            href={linkHref}
            className="block font-semibold text-ink leading-snug group-hover:text-brand-600 transition-colors"
          >
            {title}
          </Link>
        ) : (
          <h3 className="font-semibold text-ink leading-snug">{title}</h3>
        )}
        <div className="text-xs sm:text-sm text-ink-muted mt-1">
          {presenter}
        </div>
      </div>

      {/* Right column */}
      <div className="flex flex-col items-start sm:items-end gap-1.5 pt-0.5">
        {session.room ? (
          <div className="inline-flex items-center gap-1 text-sm font-semibold text-ink whitespace-nowrap">
            <MapPin className="h-3.5 w-3.5 text-ink-muted" />
            {session.room}
          </div>
        ) : (
          <div className="text-xs text-ink-muted italic">{tba}</div>
        )}
        {linkHref && (
          <Link
            href={linkHref}
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-600 hover:text-brand-700 whitespace-nowrap"
          >
            {readLabel}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
