"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ExternalLink,
  Eye,
  FileText,
  Search,
  Upload,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type {
  AdminPublicationFile,
  AdminPublicationRow,
} from "@/server/admin-publications-data";

type Toast = {
  text: string;
  tone: "success" | "danger";
} | null;

const KIND_LABEL: Record<AdminPublicationFile["kind"], string> = {
  MANUSCRIPT: "Manuscript",
  CAMERA_READY: "Camera-ready",
  E_ABSTRACT: "E-Abstract (override)",
};

export function AdminPublicationsClient({
  initialSubmissions,
}: {
  initialSubmissions: AdminPublicationRow[];
}) {
  const { locale } = useI18n();
  const [rows, setRows] = useState(initialSubmissions);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "unpublished">(
    "all"
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback(
    (text: string, tone: "success" | "danger" = "success") => {
      setToast({ text, tone });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 4000);
    },
    []
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "published" && !r.isPublished) return false;
      if (filter === "unpublished" && r.isPublished) return false;
      if (!q) return true;
      const hay = [
        r.paperCode,
        r.title,
        r.titleEn,
        r.authorName,
        r.authorEmail,
        r.trackName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, filter]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      published: rows.filter((r) => r.isPublished).length,
      withPdf: rows.filter((r) =>
        r.files.some((f) => f.mimeType === "application/pdf")
      ).length,
    }),
    [rows]
  );

  async function togglePublish(row: AdminPublicationRow) {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/submissions/${row.id}/publication`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !row.isPublished }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, isPublished: data.submission.isPublished }
            : r
        )
      );
      showToast(
        !row.isPublished
          ? "เผยแพร่บทคัดย่อแล้ว"
          : "ยกเลิกการเผยแพร่บทคัดย่อแล้ว"
      );
    } catch {
      showToast("ไม่สามารถบันทึกได้", "danger");
    } finally {
      setBusyId(null);
    }
  }

  async function changeFile(row: AdminPublicationRow, fileId: string | null) {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/submissions/${row.id}/publication`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eAbstractFileId: fileId }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, eAbstractFileId: data.submission.eAbstractFileId }
            : r
        )
      );
      showToast("บันทึกการเลือกไฟล์แล้ว");
    } catch {
      showToast("ไม่สามารถบันทึกได้", "danger");
    } finally {
      setBusyId(null);
    }
  }

  async function uploadOverride(row: AdminPublicationRow, file: File) {
    if (file.type !== "application/pdf") {
      showToast("รองรับเฉพาะไฟล์ PDF", "danger");
      return;
    }
    setBusyId(row.id);
    try {
      // 1. Get presigned URL + storedFiles row
      const initRes = await fetch(
        `/api/submissions/${row.id}/e-abstract-upload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: "application/pdf",
            fileSize: file.size,
          }),
        }
      );
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error(err?.error || "Upload init failed");
      }
      const { uploadUrl, file: storedFile } = await initRes.json();

      // 2. PUT bytes to R2
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!putRes.ok) throw new Error("PUT to R2 failed");

      // 3. Only on PUT success: assign as the published e-abstract
      const patchRes = await fetch(
        `/api/submissions/${row.id}/publication`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eAbstractFileId: storedFile.id }),
        }
      );
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}));
        throw new Error(err?.error || "Could not assign file");
      }

      const fileEntry: AdminPublicationFile = {
        id: storedFile.id,
        originalName: storedFile.originalName,
        mimeType: storedFile.mimeType,
        size: storedFile.size,
        kind: "E_ABSTRACT",
        uploadedAt: new Date().toISOString(),
      };

      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                eAbstractFileId: storedFile.id,
                files: [fileEntry, ...r.files],
              }
            : r
        )
      );
      showToast("อัปโหลดไฟล์ override แล้ว");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      showToast(msg, "danger");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 uppercase tracking-wide">
          <FileText className="h-3.5 w-3.5" />
          Admin
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold text-ink">
          จัดการการเผยแพร่บทคัดย่อ
        </h1>
        <p className="text-ink-muted max-w-3xl">
          เลือกบทความที่ ACCEPTED มาเผยแพร่บนหน้า public
          เลือกไฟล์ที่จะใช้เป็นเอกสาร e-abstract หรืออัปโหลดไฟล์แทน
        </p>
      </header>

      {toast && <Alert tone={toast.tone}>{toast.text}</Alert>}

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <StatBlock
          label="บทความทั้งหมด"
          value={stats.total}
          bg="bg-stat-info"
          color="text-blue-700"
          border="border-blue-100"
        />
        <StatBlock
          label="เผยแพร่แล้ว"
          value={stats.published}
          bg="bg-stat-success"
          color="text-emerald-700"
          border="border-emerald-100"
        />
        <StatBlock
          label="มีไฟล์ PDF"
          value={stats.withPdf}
          bg="bg-stat-brand"
          color="text-brand-700"
          border="border-brand-100"
        />
      </div>

      {/* Filter / search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหารหัสบทความ / ชื่อเรื่อง / ผู้แต่ง / สาขา"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 bg-surface-2 rounded-button p-1">
          <FilterPill
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="ทั้งหมด"
          />
          <FilterPill
            active={filter === "published"}
            onClick={() => setFilter("published")}
            label="เผยแพร่แล้ว"
          />
          <FilterPill
            active={filter === "unpublished"}
            onClick={() => setFilter("unpublished")}
            label="ยังไม่เผยแพร่"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-14 w-14" />}
          title="ไม่พบบทความ"
        />
      ) : (
        <Card>
          <CardBody className="!p-0 divide-y divide-border-light">
            {filtered.map((row) => (
              <PublicationRow
                key={row.id}
                row={row}
                busy={busyId === row.id}
                locale={locale}
                onTogglePublish={() => togglePublish(row)}
                onChangeFile={(fid) => changeFile(row, fid)}
                onUpload={(f) => uploadOverride(row, f)}
              />
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function StatBlock({
  label,
  value,
  bg,
  color,
  border,
}: {
  label: string;
  value: number;
  bg: string;
  color: string;
  border: string;
}) {
  return (
    <div className={`${bg} ${border} border rounded-card p-4`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${color}`}>
        {label}
      </div>
      <div className="text-2xl font-bold text-ink mt-1 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active
          ? "bg-white shadow-elev-1 text-ink"
          : "text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function PublicationRow({
  row,
  busy,
  locale,
  onTogglePublish,
  onChangeFile,
  onUpload,
}: {
  row: AdminPublicationRow;
  busy: boolean;
  locale: string;
  onTogglePublish: () => void;
  onChangeFile: (fileId: string | null) => void;
  onUpload: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayTitle =
    locale === "en" && row.titleEn ? row.titleEn : row.title;

  const isPdf = (f: AdminPublicationFile) => f.mimeType === "application/pdf";
  const pickedFile = row.eAbstractFileId
    ? row.files.find((f) => f.id === row.eAbstractFileId)
    : undefined;
  const fallbackPdf = row.files.find(
    (f) => f.kind === "MANUSCRIPT" && isPdf(f)
  );

  // Effective file (what public will display) = explicit pick if it's PDF,
  // else the latest PDF manuscript. Non-PDF picks/manuscripts are not served.
  const effectiveFile =
    pickedFile && isPdf(pickedFile) ? pickedFile : fallbackPdf;

  const hasAnyPdf = row.files.some(isPdf);
  const showNoPdfWarning = row.files.length > 0 && !hasAnyPdf;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px_280px] gap-4 p-4 lg:p-5 items-start">
      {/* Identity */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted bg-surface-2 px-2 py-0.5 rounded-md">
            {row.paperCode || "—"}
          </span>
          {row.trackName && (
            <span className="text-xs text-ink-muted">{row.trackName}</span>
          )}
          {row.isPublished && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-chip bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Eye className="h-3 w-3" />
              เผยแพร่อยู่
            </span>
          )}
        </div>
        <h3 className="font-semibold text-ink leading-snug">{displayTitle}</h3>
        <div className="text-sm text-ink-muted mt-1">{row.authorName}</div>
        <div className="text-xs text-ink-muted/80">{row.authorEmail}</div>
        {row.paperCode && (
          <a
            href={`/conference/abstracts/${encodeURIComponent(row.paperCode)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${
              row.isPublished
                ? "text-brand-600 hover:text-brand-700"
                : "text-ink-muted/60 cursor-default pointer-events-none"
            }`}
          >
            ดูตัวอย่างหน้า public
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* File picker */}
      <div className="min-w-0">
        <label className="block text-[10px] uppercase tracking-wide font-semibold text-ink-muted mb-1.5">
          ไฟล์ E-Abstract <span className="text-ink-faint">(PDF เท่านั้น)</span>
        </label>
        {row.files.length === 0 ? (
          <div className="text-sm text-ink-muted italic px-3 py-2 bg-surface-2 rounded-button">
            ผู้เขียนยังไม่ได้อัปโหลดไฟล์
          </div>
        ) : (
          <select
            value={row.eAbstractFileId || ""}
            disabled={busy}
            onChange={(e) =>
              onChangeFile(e.target.value === "" ? null : e.target.value)
            }
            className="w-full rounded-button border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50"
          >
            <option value="">— อัตโนมัติ (ใช้ PDF MANUSCRIPT ล่าสุด) —</option>
            {row.files.filter(isPdf).map((f) => (
              <option key={f.id} value={f.id}>
                [{KIND_LABEL[f.kind]}] {f.originalName}
              </option>
            ))}
          </select>
        )}
        {showNoPdfWarning && (
          <div className="mt-2 inline-flex items-start gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
            <span>
              ผู้เขียนยังไม่ได้แนบ PDF — กรุณาอัปโหลด PDF override ก่อนเผยแพร่
            </span>
          </div>
        )}
        {effectiveFile && (
          <a
            href={`/api/public/files/${effectiveFile.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-brand-600"
          >
            <Eye className="h-3 w-3" />
            ดูไฟล์ที่จะแสดง
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-button border border-border bg-white hover:bg-surface-2 text-ink disabled:opacity-50 transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          อัปโหลดไฟล์ override
        </button>
        <button
          type="button"
          // Prevent publishing without a PDF; un-publishing always allowed.
          disabled={busy || (!row.isPublished && !effectiveFile)}
          title={
            !row.isPublished && !effectiveFile
              ? "ต้องมี PDF (ของผู้เขียน หรือ override) ก่อนเผยแพร่"
              : undefined
          }
          onClick={onTogglePublish}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-button transition-colors ${
            row.isPublished
              ? "bg-white text-ink border border-border hover:bg-surface-2"
              : "bg-brand-gradient-btn text-white shadow-elev-1 hover:shadow-elev-2"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {row.isPublished ? (
            <>
              <Circle className="h-3.5 w-3.5" />
              ยกเลิกการเผยแพร่
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              เผยแพร่บทคัดย่อนี้
            </>
          )}
        </button>
      </div>
    </div>
  );
}
