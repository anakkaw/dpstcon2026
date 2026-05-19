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
import { Badge, Card, CardBody } from "@/components/ui";

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
      <div className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link
            href="/conference/abstracts"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("conference.detail.backToList")}
          </Link>
        </div>
      </div>

      {/* ─── Title block ──────────────────────────────────── */}
      <section className="relative bg-white border-b border-border overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          aria-hidden
        >
          <div className="absolute -top-24 -right-32 w-[420px] h-[420px] bg-orb-brand opacity-20 blur-2xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-10">
            {/* Marginalia */}
            <aside className="flex flex-col gap-4 lg:border-r lg:border-border lg:pr-8">
              <div>
                <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted mb-1">
                  {t("conference.detail.paperCode")}
                </div>
                <div className="inline-flex items-center px-3 py-1.5 rounded-button bg-brand-gradient text-white font-bold text-lg shadow-elev-1 tabular-nums">
                  {data.paperCode || "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted mb-1.5">
                  {t("conference.detail.track")}
                </div>
                <div className="text-sm text-ink font-medium">
                  {data.track?.name || "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted mb-1.5">
                  {locale === "en" ? "Format" : "รูปแบบ"}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {formats.length === 0 ? (
                    <span className="text-sm text-ink-muted">—</span>
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
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-[40px] font-extrabold text-ink leading-[1.2] tracking-tight">
                {title}
              </h1>
              {titleSecondary && (
                <h2 className="mt-3 text-lg lg:text-xl font-medium text-ink-muted leading-snug italic">
                  {titleSecondary}
                </h2>
              )}

              <div className="mt-8 pt-6 border-t border-border-light">
                <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold text-ink-muted mb-3">
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
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                      >
                        <span
                          className={
                            a.isMain
                              ? "font-semibold text-ink"
                              : "text-ink"
                          }
                        >
                          {displayName}
                        </span>
                        {a.affiliation && (
                          <span className="text-xs text-ink-muted">
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
        <section className="bg-surface-1 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 uppercase tracking-wide mb-4">
              <Calendar className="h-3.5 w-3.5" />
              {t("conference.detail.schedule")}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.presentations.map((p) => {
                const isOral = p.type === "ORAL";
                const accent = isOral
                  ? "bg-stat-info border-blue-100"
                  : "bg-stat-success border-emerald-100";
                return (
                  <div
                    key={p.id}
                    className={`rounded-card border ${accent} p-5 shadow-elev-1`}
                  >
                    <Badge tone={isOral ? "info" : "success"}>
                      {isOral
                        ? t("conference.program.typeOral")
                        : t("conference.program.typePoster")}
                    </Badge>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-ink-muted mb-1">
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
                                  <div className="text-sm font-bold text-ink tabular-nums leading-none">
                                    {locale === "en" ? "Slot" : "รอบ"} {index + 1}:{" "}
                                    {timeFmt.format(startsAt)}-{timeFmt.format(endsAt)}
                                  </div>
                                  <div className="text-xs text-ink-muted mt-1">
                                    {dateFmt.format(startsAt)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : p.scheduledAt ? (
                          <>
                            <div className="text-2xl font-bold text-ink tabular-nums leading-none">
                              {timeFmt.format(new Date(p.scheduledAt))}
                            </div>
                            <div className="text-xs text-ink-muted mt-1">
                              {dateFmt.format(new Date(p.scheduledAt))}
                              {p.duration ? (
                                <span className="ml-1">
                                  · {p.duration} min
                                </span>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-ink-muted italic">
                            {t("conference.program.tba")}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-ink-muted mb-1">
                          <MapPin className="h-3 w-3" />
                          {locale === "en" ? "Room" : "ห้อง"}
                        </div>
                        <div className="text-base font-bold text-ink">
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
        <section className="bg-white border-b border-border">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 uppercase tracking-wide mb-4">
              <FileText className="h-3.5 w-3.5" />
              {t("conference.detail.abstract")}
            </div>
            <div className="text-[15px] lg:text-base leading-[1.85] text-ink whitespace-pre-line">
              {abstract}
            </div>
            {keywords && (
              <div className="mt-8 pt-6 border-t border-border-light">
                <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted mb-2">
                  {t("conference.detail.keywords")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.split(/[,，;]/).map((k, i) => {
                    const kt = k.trim();
                    if (!kt) return null;
                    return (
                      <span
                        key={i}
                        className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-chip bg-stat-brand text-brand-700 border border-brand-100"
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
      <section className="bg-surface-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <Card>
            <CardBody>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-border-light">
                <h3 className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                  <FileText className="h-4 w-4 text-brand-600" />
                  {t("conference.detail.eAbstract")}
                </h3>
                {data.eAbstractFile && (
                  <div className="flex gap-2">
                    <Link
                      href={`/api/public/files/${data.eAbstractFile.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-semibold bg-surface-2 hover:bg-surface-hover text-ink transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t("conference.detail.openPdf")}
                    </Link>
                    <a
                      href={`/api/public/files/${data.eAbstractFile.id}`}
                      download={data.eAbstractFile.originalName}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-semibold bg-brand-gradient-btn text-white shadow-elev-1 hover:shadow-elev-2 transition-shadow"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t("conference.detail.downloadPdf")}
                    </a>
                  </div>
                )}
              </div>
              {data.eAbstractFile ? (
                <div className="rounded-card overflow-hidden border border-border bg-white">
                  <iframe
                    src={`/api/public/files/${data.eAbstractFile.id}`}
                    title={data.eAbstractFile.originalName}
                    className="w-full h-[80vh] min-h-[640px]"
                  />
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-ink-muted italic">
                  {t("conference.detail.noEAbstract")}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
