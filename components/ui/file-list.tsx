"use client";

import { useState } from "react";
import { FileText, Download, Loader2, Trash2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { PdfPreviewModal } from "@/components/ui/pdf-preview-modal";

interface StoredFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: string;
  uploadedAt: string | Date;
  uploadedById?: string | null;
  uploaderName?: string | null;
}

interface FileListProps {
  submissionId: string;
  files: StoredFile[];
  canDelete?: boolean;
  currentUserId?: string;
  onDeleteComplete?: (fileId: string) => void;
}

const KIND_KEYS: Record<string, string> = {
  MANUSCRIPT: "fileUpload.kindManuscript",
  SUPPLEMENTARY: "fileUpload.kindSupplementary",
  CAMERA_READY: "fileUpload.kindCameraReady",
  REVIEW_ATTACHMENT: "fileUpload.kindReviewAttachment",
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileList({
  submissionId,
  files,
  canDelete = false,
  currentUserId,
  onDeleteComplete,
}: FileListProps) {
  const { t } = useI18n();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StoredFile | null>(null);
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [error, setError] = useState("");

  function isPreviewable(file: StoredFile) {
    if (file.mimeType === "application/pdf") return true;
    if (file.mimeType?.startsWith("image/")) return true;
    const ext = file.originalName.toLowerCase().split(".").pop() || "";
    return ["pdf", "png", "jpg", "jpeg", "gif", "webp"].includes(ext);
  }

  async function handleDownload(fileId: string) {
    setDownloading(fileId);
    setError("");
    try {
      const res = await fetch(`/api/submissions/${submissionId}/download/${fileId}`);
      if (!res.ok) throw new Error("Download failed");
      const { url } = await res.json();
      // Open the presigned URL in a new tab
      window.open(url, "_blank");
    } catch {
      setError(t("fileUpload.downloadFailed"));
    }
    setDownloading(null);
  }

  async function handleDelete(file: StoredFile) {
    setDeleting(file.id);
    setError("");

    try {
      const res = await fetch(`/api/submissions/${submissionId}/files/${file.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || t("fileUpload.deleteFailed"));
      }

      onDeleteComplete?.(file.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("fileUpload.deleteFailed"));
    } finally {
      setDeleting(null);
      setPendingDelete(null);
    }
  }

  if (files.length === 0) {
    return (
      <p className="text-sm text-ink-muted">{t("fileUpload.noFiles")}</p>
    );
  }

  return (
    <div className="space-y-2">
      <ConfirmDialog
        open={!!pendingDelete}
        title={t("fileUpload.deleteConfirmTitle")}
        description={t("fileUpload.deleteConfirmDesc", {
          name: pendingDelete?.originalName || "",
        })}
        confirmLabel={t("fileUpload.delete")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={!!pendingDelete && deleting === pendingDelete.id}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
      />
      {error && <Alert tone="danger">{error}</Alert>}
      {files.map((file) => (
        <div
          key={file.id}
          className="flex flex-col gap-3 rounded-lg bg-surface-alt px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className={cn("h-4 w-4 shrink-0", file.kind === "REVIEW_ATTACHMENT" ? "text-violet-500" : "text-brand-500")} />
            <div className="min-w-0">
              <p className="text-sm text-ink font-medium truncate">{file.originalName}</p>
              <p className="text-xs text-ink-muted">
                {KIND_KEYS[file.kind] ? t(KIND_KEYS[file.kind] as Parameters<typeof t>[0]) : file.kind} · {formatFileSize(file.size)}
                {file.uploaderName && file.kind === "REVIEW_ATTACHMENT" && (
                  <> · {t("fileUpload.uploadedBy")} {file.uploaderName}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
            {isPreviewable(file) && (
              <button
                type="button"
                onClick={() => setPreviewFile(file)}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:w-auto sm:flex-none",
                  "text-ink hover:bg-surface-alt active:bg-surface-hover"
                )}
              >
                <Eye className="h-3.5 w-3.5" />
                {t("fileUpload.preview")}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDownload(file.id)}
              disabled={downloading === file.id || deleting === file.id}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:w-auto sm:flex-none",
                "text-brand-600 hover:bg-brand-50 active:bg-brand-100",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {downloading === file.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {t("common.download")}
            </button>

            {(canDelete || (file.kind === "REVIEW_ATTACHMENT" && currentUserId && file.uploadedById === currentUserId)) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={downloading === file.id || deleting === file.id}
                onClick={() => {
                  setError("");
                  setPendingDelete(file);
                }}
                className="flex-1 text-red-700 hover:bg-red-50 hover:text-red-800 sm:flex-none"
              >
                {deleting === file.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {t("fileUpload.delete")}
              </Button>
            )}
          </div>
        </div>
      ))}
      {previewFile && (
        <PdfPreviewModal
          open={!!previewFile}
          submissionId={submissionId}
          fileId={previewFile.id}
          fileName={previewFile.originalName}
          mimeType={previewFile.mimeType}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
