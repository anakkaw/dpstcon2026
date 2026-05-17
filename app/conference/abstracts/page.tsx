import Link from "next/link";
import { ArrowRight, FileText, Search } from "lucide-react";
import { getServerTranslator } from "@/lib/i18n/server";
import {
  getPublicAbstractCount,
  getPublicAbstracts,
  getPublicTracks,
  type PublicAbstractListItem,
} from "@/server/public-conference-data";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

type SearchParamsT = { trackId?: string; search?: string; page?: string };

export default async function ConferenceAbstractsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsT>;
}) {
  const { t, locale } = await getServerTranslator();
  const params = await searchParams;
  const trackId = params.trackId || undefined;
  const search = params.search?.trim() || undefined;
  const requestedPage = Math.max(1, Number(params.page || "1") || 1);

  const [total, tracks] = await Promise.all([
    getPublicAbstractCount({ trackId, search }),
    getPublicTracks(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const abstracts = await getPublicAbstracts({
    trackId,
    search,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  function buildHref(updates: Partial<SearchParamsT>) {
    const next = new URLSearchParams();
    const tid = updates.trackId !== undefined ? updates.trackId : trackId;
    const s = updates.search !== undefined ? updates.search : search;
    const p = updates.page !== undefined ? updates.page : page;
    if (tid) next.set("trackId", tid);
    if (s) next.set("search", s);
    if (p && Number(p) > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `?${qs}` : "/conference/abstracts";
  }

  return (
    <div>
      {/* ─── Page header ──────────────────────────────────── */}
      <section className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                <FileText className="h-3.5 w-3.5" />
                {locale === "en" ? "Section 02" : "ส่วนที่ 02"}
              </div>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-ink tracking-tight">
                {t("conference.abstracts.heading")}
              </h1>
              <p className="mt-2 text-ink-muted max-w-2xl">
                {t("conference.abstracts.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-chip bg-stat-info border border-blue-100 text-blue-700 font-semibold">
                <FileText className="h-3.5 w-3.5" />
                {total}{" "}
                {locale === "en" ? "papers" : "บทคัดย่อ"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Search + filters ─────────────────────────────── */}
      <section className="sticky top-[63px] sm:top-[65px] z-20 bg-white/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
          <form
            method="get"
            action="/conference/abstracts"
            className="relative"
          >
            {trackId && (
              <input type="hidden" name="trackId" value={trackId} />
            )}
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <input
              type="search"
              name="search"
              defaultValue={search || ""}
              placeholder={t("conference.abstracts.search")}
              className="w-full pl-9 pr-3 py-2.5 rounded-button border border-border bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted w-14">
              {locale === "en" ? "Track" : "สาขา"}
            </span>
            <Chip
              href={buildHref({ trackId: "", page: "" })}
              active={!trackId}
              label={t("conference.abstracts.allTracks")}
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

      {/* ─── Listing ──────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {abstracts.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-14 w-14" />}
            title={t("conference.abstracts.empty")}
          />
        ) : (
          <div className="bg-white rounded-card border border-border shadow-elev-1 overflow-hidden divide-y divide-border-light">
            {abstracts.map((a, i) => (
              <AbstractEntry
                key={a.id}
                entry={a}
                index={i + 1}
                offset={(page - 1) * PAGE_SIZE}
                locale={locale}
              />
            ))}
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
        <Link href={previousHref} className="text-sm font-semibold text-ink border border-border rounded-button px-4 py-2 hover:bg-surface-2">
          Previous
        </Link>
      ) : (
        <span className="text-sm font-semibold text-ink-muted border border-border rounded-button px-4 py-2 opacity-50">
          Previous
        </span>
      )}
      <span className="text-sm text-ink-muted">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={nextHref} className="text-sm font-semibold text-ink border border-border rounded-button px-4 py-2 hover:bg-surface-2">
          Next
        </Link>
      ) : (
        <span className="text-sm font-semibold text-ink-muted border border-border rounded-button px-4 py-2 opacity-50">
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
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-chip transition-colors ${
        active
          ? "bg-brand-500 text-white border-brand-500"
          : "bg-white text-ink-muted border-border hover:border-ink hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function AbstractEntry({
  entry,
  index,
  offset,
  locale,
}: {
  entry: PublicAbstractListItem;
  index: number;
  offset: number;
  locale: string;
}) {
  const title =
    locale === "en" && entry.titleEn ? entry.titleEn : entry.titleTh;
  const author =
    locale === "en" && entry.mainAuthorEn
      ? entry.mainAuthorEn
      : entry.mainAuthorTh;
  const keywords =
    locale === "en" && entry.keywordsEn
      ? entry.keywordsEn
      : entry.keywordsTh;

  const href = entry.paperCode
    ? `/conference/abstracts/${encodeURIComponent(entry.paperCode)}`
    : "#";

  return (
    <Link
      href={href}
      className="group grid grid-cols-[44px_1fr] sm:grid-cols-[44px_100px_1fr_140px] gap-3 sm:gap-5 items-start py-5 px-4 sm:px-5 hover:bg-surface-2 transition-colors"
    >
      {/* Number badge */}
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-brand-50 text-brand-700 font-bold text-sm tabular-nums">
        {String(offset + index).padStart(2, "0")}
      </div>

      {/* Paper code */}
      <div className="hidden sm:flex items-start pt-1.5">
        <span className="font-mono text-xs uppercase tracking-wide text-ink-muted bg-surface-2 px-2 py-1 rounded-md">
          {entry.paperCode || "—"}
        </span>
      </div>

      {/* Body */}
      <div className="min-w-0">
        <div className="sm:hidden flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted bg-surface-2 px-2 py-0.5 rounded-md">
            {entry.paperCode || "—"}
          </span>
        </div>
        <h3 className="font-semibold text-base lg:text-lg text-ink leading-snug group-hover:text-brand-600 transition-colors">
          {title}
        </h3>
        <div className="text-sm text-ink-muted mt-1.5">{author}</div>
        {keywords && (
          <div className="text-xs text-ink-muted/80 italic mt-1 line-clamp-1">
            {keywords}
          </div>
        )}
      </div>

      {/* Track + arrow */}
      <div className="hidden sm:flex items-start justify-end gap-2 pt-1.5">
        {entry.track && (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-chip bg-surface-2 text-ink-light border border-border">
            {entry.track.name}
          </span>
        )}
        <ArrowRight className="h-4 w-4 text-ink-muted group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all mt-1.5" />
      </div>
    </Link>
  );
}
