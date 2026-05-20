import Link from "next/link";
import { Download, FileText, Files } from "lucide-react";
import { getServerTranslator } from "@/lib/i18n/server";
import {
  getPublicDocuments,
  type PublicDocument,
} from "@/server/public-conference-data";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ConferenceDocsPage() {
  const { t, locale } = await getServerTranslator();
  const documents = await getPublicDocuments();

  return (
    <div>
      {/* ─── Page header ──────────────────────────────────── */}
      <section className="bg-transparent border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                <Files className="h-3.5 w-3.5" />
                {locale === "en" ? "Section 03" : "ส่วนที่ 03"}
              </div>
              <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight">
                {t("conference.docs.heading")}
              </h1>
              <p className="mt-2 text-slate-300 max-w-2xl font-medium">
                {t("conference.docs.subtitle")}
              </p>
            </div>
            {documents.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold shadow-[0_0_15px_rgba(16,185,129,0.1)] text-sm">
                <Files className="h-3.5 w-3.5" />
                {documents.length}{" "}
                {locale === "en" ? "documents" : "เอกสาร"}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ─── Listing ──────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {documents.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-14 w-14" />}
            title={t("conference.docs.empty")}
          />
        ) : (
          <div className="bg-white/2 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-md overflow-hidden divide-y divide-white/5">
            {documents.map((doc, i) => (
              <DocEntry
                key={doc.id}
                doc={doc}
                index={i + 1}
                locale={locale}
                downloadLabel={t("conference.docs.download")}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DocEntry({
  doc,
  index,
  locale,
  downloadLabel,
}: {
  doc: PublicDocument;
  index: number;
  locale: string;
  downloadLabel: string;
}) {
  const name = locale === "en" && doc.nameEn ? doc.nameEn : doc.nameTh;
  const desc =
    locale === "en" && doc.descriptionEn
      ? doc.descriptionEn
      : doc.descriptionTh;
  return (
    <div className="group grid grid-cols-[44px_1fr_auto] gap-3 sm:gap-5 items-start py-5 px-4 sm:px-5 hover:bg-white/4 transition-colors">
      <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold text-slate-400 tabular-nums">
            №{String(index).padStart(2, "0")}
          </span>
        </div>
        <h3 className="font-bold text-base lg:text-lg text-white leading-snug">
          {name}
        </h3>
        {desc && (
          <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
            {desc}
          </p>
        )}
      </div>
      <Link
        href={`/api/public/documents/${doc.id}/file`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${downloadLabel} ${name}`}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[linear-gradient(135deg,#fb923c_0%,#f97316_52%,#c2410c_100%)] text-white shadow-[0_0_15px_rgba(249,115,22,0.25)] border border-orange-500/20 hover:scale-[1.02] transition-all duration-200 whitespace-nowrap"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">{downloadLabel}</span>
      </Link>
    </div>
  );
}
