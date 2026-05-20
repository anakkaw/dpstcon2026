import Link from "next/link";
import { ArrowRight, Calendar, Clock, MapPin } from "lucide-react";
import { getServerTranslator } from "@/lib/i18n/server";
import { CONFERENCE_TZ } from "@/lib/conference-tz";
import {
  getPublicProgram,
  getPublicProgramCount,
  getPublicTracks,
  type PublicProgramItem,
} from "@/server/public-conference-data";
import { Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

type Search = { trackId?: string; type?: string; page?: string };

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
  const requestedPage = Math.max(1, Number(params.page || "1") || 1);

  const [total, tracks] = await Promise.all([
    getPublicProgramCount({ trackId, type: typeFilter }),
    getPublicTracks(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const program = await getPublicProgram({
    trackId,
    type: typeFilter,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

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
    const p = updates.page !== undefined ? updates.page : page;
    if (tid) next.set("trackId", tid);
    if (ty) next.set("type", ty);
    if (p && Number(p) > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `?${qs}` : "/conference/program";
  }

  return (
    <div>
      {/* ─── Page header ──────────────────────────────────── */}
      <section className="bg-transparent border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider mb-2">
                <Calendar className="h-3.5 w-3.5" />
                {locale === "en" ? "Section 01" : "ส่วนที่ 01"}
              </div>
              <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight">
                {t("conference.program.heading")}
              </h1>
              <p className="mt-2 text-slate-300 max-w-2xl font-medium">
                {t("conference.program.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-bold shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                <Calendar className="h-3.5 w-3.5" />
                {total}{" "}
                {locale === "en" ? "sessions" : "เซสชัน"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Filters (sticky chips) ───────────────────────── */}
      <section className="sticky top-[63px] sm:top-[65px] z-20 bg-slate-950/40 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 w-14">
              {t("conference.program.filterType")}
            </span>
            <Chip
              href={buildHref({ type: "", page: "" })}
              active={!typeFilter}
              label={t("conference.program.allTypes")}
            />
            <Chip
              href={buildHref({ type: "ORAL", page: "" })}
              active={typeFilter === "ORAL"}
              label={t("conference.program.typeOral")}
              tone="info"
            />
            <Chip
              href={buildHref({ type: "POSTER", page: "" })}
              active={typeFilter === "POSTER"}
              label={t("conference.program.typePoster")}
              tone="success"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 w-14">
              {t("conference.program.filterTrack")}
            </span>
            <Chip
              href={buildHref({ trackId: "", page: "" })}
              active={!trackId}
              label={t("conference.program.allTracks")}
            />
            {tracks.map((tk) => (
              <Chip
                key={tk.id}
                href={buildHref({ trackId: tk.id, page: "" })}
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
                    <div className="flex items-baseline gap-3 px-4 py-3 rounded-2xl border border-white/5 bg-gradient-to-r from-orange-500/10 to-amber-600/10 text-white shadow-[0_0_20px_rgba(249,115,22,0.05)] ring-1 ring-orange-500/10">
                      <div className="text-[10px] uppercase tracking-widest font-bold text-orange-400">
                        Day {dIdx + 1}
                      </div>
                      <div className="text-4xl font-black leading-none tabular-nums">
                        {date.toLocaleDateString("en-GB", { day: "numeric" })}
                      </div>
                      <div className="text-sm font-semibold text-slate-300">
                        {date.toLocaleDateString(
                          locale === "en" ? "en-GB" : "th-TH",
                          { month: "short" }
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-slate-400">
                      <div className="font-bold text-white text-base">
                        {date.toLocaleDateString(
                          locale === "en" ? "en-GB" : "th-TH",
                          { weekday: "long" }
                        )}
                      </div>
                      <div className="text-xs mt-0.5">
                        {sessions.length}{" "}
                        {locale === "en" ? "sessions" : "เซสชัน"}
                      </div>
                    </div>
                  </header>

                  {/* Session rows */}
                  <div className="bg-white/2 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-md overflow-hidden divide-y divide-white/5">
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
        {totalPages > 1 && (
          <Pager
            page={page}
            totalPages={totalPages}
            previousHref={buildHref({ page: String(page - 1) })}
            nextHref={buildHref({ page: String(page + 1) })}
          />
        )}
      </section>
    </div>
  );
}

function Pager({
  page,
  totalPages,
  previousHref,
  nextHref,
}: {
  page: number;
  totalPages: number;
  previousHref: string;
  nextHref: string;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={previousHref} className="text-sm font-bold text-slate-200 border border-white/10 rounded-xl bg-white/3 px-4 py-2 hover:bg-white/5 hover:text-white transition-all">
          Previous
        </Link>
      ) : (
        <span className="text-sm font-bold text-slate-500 border border-white/5 rounded-xl bg-white/1 px-4 py-2 opacity-30">
          Previous
        </span>
      )}
      <span className="text-sm text-slate-400 font-medium">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={nextHref} className="text-sm font-bold text-slate-200 border border-white/10 rounded-xl bg-white/3 px-4 py-2 hover:bg-white/5 hover:text-white transition-all">
          Next
        </Link>
      ) : (
        <span className="text-sm font-bold text-slate-500 border border-white/5 rounded-xl bg-white/1 px-4 py-2 opacity-30">
          Next
        </span>
      )}
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
      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
      : tone === "success"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
      : "bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-[0_0_12px_rgba(249,115,22,0.15)]"
    : "bg-white/3 text-slate-300 border-white/5 hover:border-white/20 hover:bg-white/5 hover:text-white";
  return (
    <Link
      href={href}
      className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold border rounded-full transition-all duration-200 ${activeClasses}`}
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
  const slotTimeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: CONFERENCE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const posterSlotLabels = session.posterSlots.map((slot, index) => {
    const startsAt = new Date(slot.startsAt);
    const endsAt = new Date(slot.endsAt);
    return {
      id: slot.id,
      label: `${locale === "en" ? "Slot" : "รอบ"} ${index + 1}: ${slotTimeFmt.format(startsAt)}-${slotTimeFmt.format(endsAt)}`,
      room: slot.room,
    };
  });

  const accentBar = isOral 
    ? "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]" 
    : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]";

  return (
    <div className="group relative grid grid-cols-[8px_90px_1fr_auto] sm:grid-cols-[8px_110px_1fr_160px] gap-3 sm:gap-5 items-start py-4 sm:py-5 pl-3 pr-4 sm:pr-5 hover:bg-white/4 transition-colors">
      {/* Type accent bar */}
      <span className={`${accentBar} w-[3px] self-stretch rounded-full`} />

      {/* Time */}
      <div className="pt-0.5">
        <div className="text-xl sm:text-2xl font-black text-white tabular-nums leading-none flex items-baseline gap-1">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          {time}
        </div>
        {session.duration ? (
          <div className="mt-1 text-[11px] uppercase tracking-wider font-bold text-slate-400 tabular-nums">
            {session.duration} min
          </div>
        ) : !isOral && posterSlotLabels.length > 0 ? (
          <div className="mt-1 text-[11px] uppercase tracking-wider font-bold text-slate-400 tabular-nums">
            {posterSlotLabels.length} {locale === "en" ? "slots" : "รอบ"}
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
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 bg-white/5 px-1.5 py-0.5 rounded-md border border-white/5">
              {session.paperCode}
            </span>
          )}
          {session.track?.name && (
            <>
              <span className="text-slate-500">·</span>
              <span className="text-xs font-semibold text-slate-400">
                {session.track.name}
              </span>
            </>
          )}
        </div>
        {linkHref ? (
          <Link
            href={linkHref}
            className="block font-bold text-white text-base sm:text-lg leading-snug group-hover:text-orange-400 transition-colors"
          >
            {title}
          </Link>
        ) : (
          <h3 className="font-bold text-white text-base sm:text-lg leading-snug">{title}</h3>
        )}
        <div className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
          {presenter}
        </div>
        {!isOral && posterSlotLabels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {posterSlotLabels.map((slot) => (
              <span
                key={slot.id}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300"
              >
                <Clock className="h-3 w-3" />
                {slot.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right column */}
      <div className="flex flex-col items-start sm:items-end gap-1.5 pt-0.5">
        {session.room ? (
          <div className="inline-flex items-center gap-1 text-sm font-bold text-slate-200 whitespace-nowrap">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            {session.room}
          </div>
        ) : (
          <div className="text-xs text-slate-400 font-medium italic">{tba}</div>
        )}
        {linkHref && (
          <Link
            href={linkHref}
            className="inline-flex items-center gap-0.5 text-xs font-bold text-orange-400 hover:text-orange-300 whitespace-nowrap"
          >
            {readLabel}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
