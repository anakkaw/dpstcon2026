"use client";

import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StoredFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: string;
  uploadedAt: string | Date;
}

interface FileListProps {
  submissionId: string;
  files: StoredFile[];
}

const KIND_LABELS: Record<string, string> = {
  MANUSCRIPT: "ต้นฉบับ",
  SUPPLEMENTARY: "เอกสารเสริม",
  CAMERA_READY: "Camera-Ready",
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileList({ submissionId, files }: FileListProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(fileId: string, fileName: string) {
    setDownloading(fileId);
    try {
      const res = await fetch(`/api/submissions/${submissionId}/download/${fileId}`);
      if (!res.ok) throw new Error("Download failed");
      const { url } = await res.json();
      // Open the presigned URL in a new tab
      window.open(url, "_blank");
    } catch {
      alert("ไม่สามารถดาวน์โหลดไฟล์ได้");
    }
    setDownloading(null);
  }

  if (files.length === 0) {
    return (
      <p className="text-sm text-ink-muted">ยังไม่มีไฟล์แนบ</p>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between gap-3 bg-surface-alt rounded-lg px-3 py-2.5"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="h-4 w-4 text-brand-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-ink font-medium truncate">{file.originalName}</p>
              <p className="text-xs text-ink-muted">
                {KIND_LABELS[file.kind] || file.kind} · {formatFileSize(file.size)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleDownload(file.id, file.originalName)}
            disabled={downloading === file.id}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors shrink-0",
              "text-brand-600 hover:bg-brand-50 active:bg-brand-100",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {downloading === file.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            ดาวน์โหลด
          </button>
        </div>
      ))}
    </div>
  );
}
