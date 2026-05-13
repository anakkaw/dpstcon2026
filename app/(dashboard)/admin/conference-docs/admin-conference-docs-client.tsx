"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Download,
  Eye,
  EyeOff,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ModalShell } from "@/components/ui/modal-shell";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AdminConferenceDoc } from "@/server/admin-conference-docs-data";

type Toast = { text: string; tone: "success" | "danger" } | null;

type CreateForm = {
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  slug: string;
  isPublic: boolean;
  orderIndex: number;
  file: File | null;
};

const EMPTY_CREATE: CreateForm = {
  name: "",
  nameEn: "",
  description: "",
  descriptionEn: "",
  slug: "",
  isPublic: true,
  orderIndex: 0,
  file: null,
};

export function AdminConferenceDocsClient({
  initialDocs,
}: {
  initialDocs: AdminConferenceDoc[];
}) {
  const [docs, setDocs] = useState(initialDocs);
  const [modal, setModal] = useState<
    null | { mode: "create" } | { mode: "edit"; doc: AdminConferenceDoc }
  >(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  async function refresh() {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      if (data.templates) {
        setDocs(
          data.templates.map((d: AdminConferenceDoc) => ({
            ...d,
            createdAt: d.createdAt,
          }))
        );
      }
    } catch {
      /* ignore */
    }
  }

  async function handleDelete(doc: AdminConferenceDoc) {
    try {
      const res = await fetch(`/api/templates/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      showToast("ลบเอกสารแล้ว");
    } catch {
      showToast("ไม่สามารถลบได้", "danger");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wide">
            <FileText className="h-3.5 w-3.5" />
            Admin
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-ink">
            จัดการเอกสารงานประชุม
          </h1>
          <p className="text-ink-muted max-w-3xl text-sm">
            อัปโหลด PDF เพื่อแสดงบนหน้า public (เอกสาร welcome ใช้ slug
            =&nbsp;
            <code className="text-xs px-1 py-0.5 bg-surface-2 rounded">
              welcome
            </code>
            )
          </p>
        </div>
        <Button onClick={() => setModal({ mode: "create" })}>
          <Plus className="h-4 w-4 mr-1.5" />
          เพิ่มเอกสาร
        </Button>
      </header>

      {toast && <Alert tone={toast.tone}>{toast.text}</Alert>}

      {docs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-14 w-14" />}
          title="ยังไม่มีเอกสาร"
        />
      ) : (
        <Card>
          <CardBody className="!p-0 divide-y divide-border-light">
            {docs.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                onEdit={() => setModal({ mode: "edit", doc })}
                onDelete={() => setDeletingId(doc.id)}
              />
            ))}
          </CardBody>
        </Card>
      )}

      {modal && (
        <DocFormModal
          mode={modal.mode}
          initial={modal.mode === "edit" ? modal.doc : undefined}
          onClose={() => setModal(null)}
          onSaved={async (msg) => {
            await refresh();
            showToast(msg);
            setModal(null);
          }}
          onError={(msg) => showToast(msg, "danger")}
        />
      )}

      {deletingId && (
        <ConfirmDialog
          open={true}
          title="ลบเอกสารนี้?"
          description="เอกสารและไฟล์บน R2 จะถูกลบถาวร"
          confirmLabel="ลบ"
          cancelLabel="ยกเลิก"
          tone="danger"
          onConfirm={() => {
            const doc = docs.find((d) => d.id === deletingId);
            if (doc) handleDelete(doc);
          }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}

function DocRow({
  doc,
  onEdit,
  onDelete,
}: {
  doc: AdminConferenceDoc;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-[44px_1fr_auto] gap-3 sm:gap-5 items-start p-4 sm:p-5">
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600">
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-mono text-[11px] text-ink-muted tabular-nums">
            #{doc.orderIndex}
          </span>
          {doc.slug && (
            <span className="text-[11px] font-mono px-1.5 py-0.5 bg-surface-2 text-ink-muted rounded">
              {doc.slug}
            </span>
          )}
          {doc.isPublic ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-chip bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Eye className="h-3 w-3" />
              เผยแพร่
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-chip bg-surface-2 text-ink-muted border border-border">
              <EyeOff className="h-3 w-3" />
              ซ่อน
            </span>
          )}
        </div>
        <div className="font-semibold text-ink">{doc.name}</div>
        {doc.nameEn && (
          <div className="text-sm text-ink-muted italic">{doc.nameEn}</div>
        )}
        {doc.description && (
          <div className="text-sm text-ink-muted mt-1 line-clamp-2">
            {doc.description}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <a
          href={`/api/templates/${doc.id}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-button border border-border bg-white hover:bg-surface-2 text-ink-muted hover:text-ink transition-colors"
          title="ดาวน์โหลด"
          aria-label={`ดาวน์โหลด ${doc.name}`}
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
        </a>
        <button
          onClick={onEdit}
          className="p-2 rounded-button border border-border bg-white hover:bg-surface-2 text-ink-muted hover:text-ink transition-colors"
          title="แก้ไข"
          aria-label={`แก้ไข ${doc.name}`}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-button border border-border bg-white hover:bg-red-50 text-ink-muted hover:text-red-600 transition-colors"
          title="ลบ"
          aria-label={`ลบ ${doc.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function DocFormModal({
  mode,
  initial,
  onClose,
  onSaved,
  onError,
}: {
  mode: "create" | "edit";
  initial?: AdminConferenceDoc;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState<CreateForm>(
    initial
      ? {
          name: initial.name,
          nameEn: initial.nameEn || "",
          description: initial.description || "",
          descriptionEn: initial.descriptionEn || "",
          slug: initial.slug || "",
          isPublic: initial.isPublic,
          orderIndex: initial.orderIndex,
          file: null,
        }
      : EMPTY_CREATE
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      onError("กรุณาระบุชื่อเอกสาร");
      return;
    }
    if (mode === "create" && !form.file) {
      onError("กรุณาเลือกไฟล์ PDF");
      return;
    }
    if (form.file && form.file.type !== "application/pdf") {
      onError("รองรับเฉพาะไฟล์ PDF");
      return;
    }
    if (form.slug && !/^[a-z0-9-]+$/.test(form.slug)) {
      onError("slug ต้องเป็นตัวอักษรเล็ก ตัวเลข และขีดกลางเท่านั้น");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        const file = form.file!;
        const initRes = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            nameEn: form.nameEn.trim() || undefined,
            description: form.description.trim() || undefined,
            descriptionEn: form.descriptionEn.trim() || undefined,
            slug: form.slug.trim() || undefined,
            isPublic: form.isPublic,
            orderIndex: form.orderIndex,
            fileName: file.name,
            mimeType: "application/pdf",
          }),
        });
        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({}));
          throw new Error(err?.error || "Create failed");
        }
        const { uploadUrl } = await initRes.json();
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/pdf" },
          body: file,
        });
        if (!putRes.ok) throw new Error("Upload failed");
        onSaved("เพิ่มเอกสารแล้ว");
      } else {
        const patchRes = await fetch(`/api/templates/${initial!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            nameEn: form.nameEn.trim() || null,
            description: form.description.trim() || null,
            descriptionEn: form.descriptionEn.trim() || null,
            slug: form.slug.trim() || null,
            isPublic: form.isPublic,
            orderIndex: form.orderIndex,
          }),
        });
        if (!patchRes.ok) {
          const err = await patchRes.json().catch(() => ({}));
          throw new Error(err?.error || "Update failed");
        }
        onSaved("บันทึกการแก้ไขแล้ว");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setForm((s) => ({ ...s, file: f }));
  }

  return (
    <ModalShell
      title={mode === "create" ? "เพิ่มเอกสาร" : "แก้ไขเอกสาร"}
      open={true}
      onClose={onClose}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="ชื่อ (ไทย)" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="เช่น กำหนดการ"
              required
            />
          </Field>
          <Field label="ชื่อ (อังกฤษ)">
            <Input
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              placeholder="e.g. Programme"
            />
          </Field>
        </div>
        <Field label="คำอธิบาย (ไทย)">
          <Textarea
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            rows={2}
          />
        </Field>
        <Field label="คำอธิบาย (อังกฤษ)">
          <Textarea
            value={form.descriptionEn}
            onChange={(e) =>
              setForm({ ...form, descriptionEn: e.target.value })
            }
            rows={2}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Slug"
            hint='สำหรับ welcome PDF ใช้ "welcome" (ตัวเล็ก-ตัวเลข-ขีดกลาง)'
          >
            <Input
              value={form.slug}
              onChange={(e) =>
                setForm({ ...form, slug: e.target.value.toLowerCase() })
              }
              placeholder="welcome"
            />
          </Field>
          <Field label="ลำดับการแสดง">
            <Input
              type="number"
              min={0}
              value={form.orderIndex}
              onChange={(e) =>
                setForm({
                  ...form,
                  orderIndex: parseInt(e.target.value, 10) || 0,
                })
              }
            />
          </Field>
        </div>
        <Field label="สถานะ">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) =>
                setForm({ ...form, isPublic: e.target.checked })
              }
            />
            <span className="text-sm">เผยแพร่บนหน้า public</span>
          </label>
        </Field>
        {mode === "create" && (
          <Field label="ไฟล์ PDF" required>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-button file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
              required
            />
            {form.file && (
              <div className="mt-2 text-xs text-ink-muted">
                เลือกแล้ว: {form.file.name} (
                {(form.file.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-border-light">
          <Button variant="ghost" onClick={onClose} type="button" disabled={saving}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={saving}>
            <Upload className="h-4 w-4 mr-1.5" />
            {saving
              ? "กำลังบันทึก..."
              : mode === "create"
              ? "อัปโหลด"
              : "บันทึก"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
