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
      <section className="bg-transparent border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider mb-2">
                <FileText className="h-3.5 w-3.5" />
                {locale === "en" ? "Section 02" : "ส่วนที่ 02"}
              </div>
              <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight">
                {t("conference.abstracts.heading")}
              </h1>
              <p className="mt-2 text-slate-300 max-w-2xl font-medium">
                {t("conference.abstracts.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-bold shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                <FileText className="h-3.5 w-3.5" />
                {total}{" "}
                {locale === "en" ? "papers" : "บทคัดย่อ"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Search + filters ─────────────────────────────── */}
      <section className="sticky top-[63px] sm:top-[65px] z-20 bg-slate-950/40 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-3">
          <form
            method="get"
            action="/conference/abstracts"
            className="relative"
          >
            {trackId && (
              <input type="hidden" name="trackId" value={trackId} />
            )}
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              name="search"
              defaultValue={search || ""}
              placeholder={t("conference.abstracts.search")}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/3 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/20"
            />
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 w-14">
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
          <div className="bg-white/2 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-md overflow-hidden divide-y divide-white/5">
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
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold border rounded-full transition-all duration-200 ${
        active
          ? "bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-[0_0_12px_rgba(249,115,22,0.15)]"
          : "bg-white/3 text-slate-300 border-white/5 hover:border-white/20 hover:bg-white/5 hover:text-white"
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
      className="group grid grid-cols-[44px_1fr] sm:grid-cols-[44px_100px_1fr_140px] gap-3 sm:gap-5 items-start py-5 px-4 sm:px-5 hover:bg-white/4 transition-colors"
    >
      {/* Number badge */}
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-white/5 text-orange-400 border border-white/5 font-bold text-sm tabular-nums">
        {String(offset + index).padStart(2, "0")}
      </div>

      {/* Paper code */}
      <div className="hidden sm:flex items-start pt-1.5">
        <span className="font-mono text-xs uppercase tracking-wide text-slate-400 bg-white/5 px-2 py-1 rounded-md border border-white/5">
          {entry.paperCode || "—"}
        </span>
      </div>

      {/* Body */}
      <div className="min-w-0">
        <div className="sm:hidden flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
            {entry.paperCode || "—"}
          </span>
        </div>
        <h3 className="font-bold text-base lg:text-lg text-white leading-snug group-hover:text-orange-400 transition-colors">
          {title}
        </h3>
        <div className="text-sm text-slate-300 mt-1.5">{author}</div>
        {keywords && (
          <div className="text-xs text-slate-400 italic mt-1 line-clamp-1">
            {keywords}
          </div>
        )}
      </div>

      {/* Track + arrow */}
      <div className="hidden sm:flex items-start justify-end gap-2 pt-1.5">
        {entry.track && (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-white/5 text-slate-300 border border-white/5">
            {entry.track.name}
          </span>
        )}
        <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all mt-1.5" />
      </div>
    </Link>
  );
}
