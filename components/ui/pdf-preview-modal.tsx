"use client";

import { useEffect, useRef, useState, useId } from "react";
import { Download, ExternalLink, Loader2, X, AlertCircle, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface PdfPreviewModalProps {
  open: boolean;
  submissionId: string;
  fileId: string;
  fileName: string;
  mimeType?: string;
  onClose: () => void;
}

function canInlinePreview(fileName: string, mimeType?: string): boolean {
  if (mimeType === "application/pdf") return true;
  if (mimeType?.startsWith("image/")) return true;
  const ext = fileName.toLowerCase().split(".").pop() || "";
  return ["pdf", "png", "jpg", "jpeg", "gif", "webp"].includes(ext);
}

export function PdfPreviewModal({
  open,
  submissionId,
  fileId,
  fileName,
  mimeType,
  onClose,
}: PdfPreviewModalProps) {
  const inlineSupported = canInlinePreview(fileName, mimeType);
  const { t } = useI18n();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch presigned URL each time modal opens
  useEffect(() => {
    if (!open) {
      setUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/submissions/${submissionId}/download/${fileId}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as { url?: string };
        if (!cancelled) {
          if (data.url) setUrl(data.url);
          else setError("missing_url");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, submissionId, fileId]);

  // Focus management + ESC
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    requestAnimationFrame(() => dialogRef.current?.focus());

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll while open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl",
          "h-[95vh] sm:h-[92vh]",
          "focus:outline-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="truncate text-sm font-semibold text-ink sm:text-base">
              {fileName}
            </h3>
            <p className="truncate text-xs text-ink-muted">{t("pdfPreview.subtitle")}</p>
          </div>
          {url && (
            <>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-ink hover:bg-surface-alt transition-colors"
                title={t("pdfPreview.openInNewTab")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("pdfPreview.openInNewTab")}
              </a>
              <a
                href={url}
                download={fileName}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                {t("common.download")}
              </a>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-gray-100 hover:text-ink transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="relative flex-1 bg-slate-100">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-ink-muted">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
              <span className="text-sm">{t("pdfPreview.loading")}</span>
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="text-sm font-medium text-ink">{t("pdfPreview.error")}</p>
              <p className="text-xs text-ink-muted">{t("pdfPreview.errorHint")}</p>
            </div>
          )}
          {url && !loading && !error && inlineSupported && (
            <>
              <iframe
                src={url}
                title={fileName}
                className="h-full w-full border-0"
              />
              {/* Fallback link shown if iframe is blocked (z-index keeps it behind iframe) */}
              <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1.5 text-[11px] text-ink-muted shadow-sm backdrop-blur">
                {t("pdfPreview.fallbackHint")}{" "}
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto font-medium text-brand-600 hover:underline"
                >
                  {t("pdfPreview.openInNewTab")}
                </a>
              </div>
            </>
          )}
          {url && !loading && !error && !inlineSupported && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <FileText className="h-12 w-12 text-ink-muted/60" />
              <div>
                <p className="text-sm font-semibold text-ink">{t("pdfPreview.notPreviewable")}</p>
                <p className="mt-1 text-xs text-ink-muted">{t("pdfPreview.notPreviewableHint")}</p>
              </div>
              <div className="flex gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-surface-alt"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("pdfPreview.openInNewTab")}
                </a>
                <a
                  href={url}
                  download={fileName}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                >
                  <Download className="h-4 w-4" />
                  {t("common.download")}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
