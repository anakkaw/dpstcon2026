import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  Users,
} from "lucide-react";
import { getServerTranslator } from "@/lib/i18n/server";
import { CONFERENCE_TZ } from "@/lib/conference-tz";
import { getPublicAbstractByPaperCode } from "@/server/public-conference-data";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AbstractDetailPage({
  params,
}: {
  params: Promise<{ paperCode: string }>;
}) {
  const { t, locale } = await getServerTranslator();
  const { paperCode } = await params;
  // Next.js dynamic route params arrive already decoded.
  const data = await getPublicAbstractByPaperCode(paperCode);
  if (!data) notFound();

  const title =
    locale === "en" && data.titleEn ? data.titleEn : data.titleTh;
  const titleSecondary =
    locale === "en" ? data.titleTh : data.titleEn;
  const abstract =
    locale === "en" && data.abstractEn ? data.abstractEn : data.abstractTh;
  const keywords =
    locale === "en" && data.keywordsEn
      ? data.keywordsEn
      : data.keywordsTh;

  const dateFmt = new Intl.DateTimeFormat(
    locale === "en" ? "en-GB" : "th-TH",
    {
      timeZone: CONFERENCE_TZ,
      weekday: "short",
      day: "numeric",
      month: "short",
    }
  );
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: CONFERENCE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const formats = Array.from(
    new Set(data.presentations.map((p) => p.type))
  );

  return (
    <div>
      {/* ─── Back link ────────────────────────────────────── */}
      <div className="bg-transparent border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link
            href="/conference/abstracts"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-orange-400 font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("conference.detail.backToList")}
          </Link>
        </div>
      </div>

      {/* ─── Title block ──────────────────────────────────── */}
      <section className="relative bg-transparent border-b border-white/5 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          aria-hidden
        >
          <div className="absolute -top-24 -right-32 w-[420px] h-[420px] bg-orange-500/5 opacity-20 blur-2xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-10">
            {/* Marginalia */}
            <aside className="flex flex-col gap-4 lg:border-r lg:border-white/5 lg:pr-8">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                  {t("conference.detail.paperCode")}
                </div>
                <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-[linear-gradient(135deg,#fb923c_0%,#f97316_52%,#c2410c_100%)] text-white font-bold text-lg shadow-[0_0_15px_rgba(249,115,22,0.25)] border border-orange-500/20 tabular-nums">
                  {data.paperCode || "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">
                  {t("conference.detail.track")}
                </div>
                <div className="text-sm text-white font-bold">
                  {data.track?.name || "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">
                  {locale === "en" ? "Format" : "รูปแบบ"}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {formats.length === 0 ? (
                    <span className="text-sm text-slate-400">—</span>
                  ) : (
                    formats.map((f) => (
                      <Badge key={f} tone={f === "ORAL" ? "info" : "success"}>
                        {f === "ORAL"
                          ? t("conference.program.typeOral")
                          : t("conference.program.typePoster")}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </aside>

            {/* Main title + authors */}
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-[40px] font-black text-white leading-[1.2] tracking-tight">
                {title}
              </h1>
              {titleSecondary && (
                <h2 className="mt-3 text-lg lg:text-xl font-medium text-slate-400 leading-snug italic">
                  {titleSecondary}
                </h2>
              )}

              <div className="mt-8 pt-6 border-t border-white/5">
                <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                  <Users className="h-3 w-3" />
                  {t("conference.detail.authors")}
                </div>
                <ul className="space-y-1.5">
                  {data.authors.map((a, i) => {
                    const displayName =
                      locale === "en" && a.nameEn ? a.nameEn : a.nameTh;
                    return (
                      <li
                        key={i}
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-slate-200"
                      >
                        <span
                          className={
                            a.isMain
                              ? "font-bold text-white text-base"
                              : "text-slate-200 text-sm"
                          }
                        >
                          {displayName}
                        </span>
                        {a.affiliation && (
                          <span className="text-xs text-slate-400">
                            — {a.affiliation}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Schedule ─────────────────────────────────────── */}
      {data.presentations.length > 0 && (
        <section className="bg-slate-950/20 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider mb-4">
              <Calendar className="h-3.5 w-3.5" />
              {t("conference.detail.schedule")}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.presentations.map((p) => {
                const isOral = p.type === "ORAL";
                const accent = isOral
                  ? "bg-cyan-500/5 border-cyan-500/20 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.05)]"
                  : "bg-emerald-500/5 border-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.05)]";
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border ${accent} p-5 backdrop-blur-md`}
                  >
                    <Badge tone={isOral ? "info" : "success"}>
                      {isOral
                        ? t("conference.program.typeOral")
                        : t("conference.program.typePoster")}
                    </Badge>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                          <Clock className="h-3 w-3" />
                          {locale === "en" ? "Time" : "เวลา"}
                        </div>
                        {p.type === "POSTER" && p.posterSlots.length > 0 ? (
                          <div className="space-y-2">
                            {p.posterSlots.map((slot, index) => {
                              const startsAt = new Date(slot.startsAt);
                              const endsAt = new Date(slot.endsAt);
                              return (
                                <div key={slot.id}>
                                  <div className="text-sm font-bold text-white tabular-nums leading-none">
                                    {locale === "en" ? "Slot" : "รอบ"} {index + 1}:{" "}
                                    {timeFmt.format(startsAt)}-{timeFmt.format(endsAt)}
                                  </div>
                                  <div className="text-xs text-slate-400 mt-1">
                                    {dateFmt.format(startsAt)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : p.scheduledAt ? (
                          <>
                            <div className="text-2xl font-black text-white tabular-nums leading-none">
                              {timeFmt.format(new Date(p.scheduledAt))}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {dateFmt.format(new Date(p.scheduledAt))}
                              {p.duration ? (
                                <span className="ml-1">
                                  · {p.duration} min
                                </span>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-400 italic">
                            {t("conference.program.tba")}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                          <MapPin className="h-3 w-3" />
                          {locale === "en" ? "Room" : "ห้อง"}
                        </div>
                        <div className="text-base font-bold text-white">
                          {p.room || t("conference.program.tba")}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── Abstract body ────────────────────────────────── */}
      {abstract && (
        <section className="bg-transparent border-b border-white/5">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider mb-4">
              <FileText className="h-3.5 w-3.5" />
              {t("conference.detail.abstract")}
            </div>
            <div className="text-[15px] lg:text-base leading-[1.85] text-slate-200 whitespace-pre-line font-medium">
              {abstract}
            </div>
            {keywords && (
              <div className="mt-8 pt-6 border-t border-white/5">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">
                  {t("conference.detail.keywords")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.split(/[,，;]/).map((k, i) => {
                    const kt = k.trim();
                    if (!kt) return null;
                    return (
                      <span
                        key={i}
                        className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-white/5 text-slate-300 border border-white/5"
                      >
                        {kt}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── E-Abstract PDF ───────────────────────────────── */}
      <section className="bg-slate-950/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="bg-white/2 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-md">
            <div className="px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/5">
                <h3 className="inline-flex items-center gap-2 text-sm font-bold text-white">
                  <FileText className="h-4 w-4 text-orange-400" />
                  {t("conference.detail.eAbstract")}
                </h3>
                {data.eAbstractFile && (
                  <div className="flex gap-2">
                    <Link
                      href={`/api/public/files/${data.eAbstractFile.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/3 border border-white/10 hover:bg-white/5 text-slate-200 hover:text-white transition-all duration-200"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t("conference.detail.openPdf")}
                    </Link>
                    <a
                      href={`/api/public/files/${data.eAbstractFile.id}`}
                      download={data.eAbstractFile.originalName}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[linear-gradient(135deg,#fb923c_0%,#f97316_52%,#c2410c_100%)] text-white shadow-[0_0_15px_rgba(249,115,22,0.25)] hover:scale-[1.02] transition-all duration-200"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t("conference.detail.downloadPdf")}
                    </a>
                  </div>
                )}
              </div>
              {data.eAbstractFile ? (
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate-950/40">
                  <iframe
                    src={`/api/public/files/${data.eAbstractFile.id}`}
                    title={data.eAbstractFile.originalName}
                    className="w-full h-[80vh] min-h-[640px] border-0"
                  />
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-slate-400 italic">
                  {t("conference.detail.noEAbstract")}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
