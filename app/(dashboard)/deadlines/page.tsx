"use client";

import { useState, useEffect } from "react";
import { useDashboardAuth } from "@/components/dashboard-auth-context";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/section-title";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageLoading } from "@/components/ui/page-loading";
import { formatDate } from "@/lib/utils";
import { getDaysUntil } from "@/lib/author-utils";
import { useI18n } from "@/lib/i18n";
import {
  FileText, Download, Save, Plus, Trash2, Pencil, X,
  Clock, CheckCircle2, AlertTriangle,
} from "lucide-react";

interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  fileKey?: string;
  mimeType?: string | null;
  createdAt?: string;
}

interface DeadlineSettings {
  submissionDeadline?: string;
  reviewDeadline?: string;
  cameraReadyDeadline?: string;
  notificationDate?: string;
  submissionDeadlineLabel?: string;
  reviewDeadlineLabel?: string;
  cameraReadyDeadlineLabel?: string;
  notificationDateLabel?: string;
}

const DEADLINE_FALLBACKS: DeadlineSettings = {
  submissionDeadline: "2026-06-30",
  reviewDeadline: "2026-08-15",
  cameraReadyDeadline: "2026-09-30",
  notificationDate: "2026-08-31",
};

export default function DeadlinesPage() {
  const { t, locale } = useI18n();
  const { roles } = useDashboardAuth();
  const isAdmin = roles.some((role) => ["ADMIN", "PROGRAM_CHAIR"].includes(role));
  const deadlineDefaults = [
    { defaultLabel: t("deadlines.paperSubmission"), key: "submissionDeadline" as const, labelKey: "submissionDeadlineLabel" as const, icon: FileText, step: 1 },
    { defaultLabel: t("deadlines.reviewDeadline"), key: "reviewDeadline" as const, labelKey: "reviewDeadlineLabel" as const, icon: Clock, step: 2 },
    { defaultLabel: t("deadlines.notification"), key: "notificationDate" as const, labelKey: "notificationDateLabel" as const, icon: AlertTriangle, step: 3 },
    { defaultLabel: t("deadlines.cameraReady"), key: "cameraReadyDeadline" as const, labelKey: "cameraReadyDeadlineLabel" as const, icon: CheckCircle2, step: 4 },
  ];

  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [settings, setSettings] = useState<DeadlineSettings>({});
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<DeadlineSettings>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "danger">("success");
  const [loading, setLoading] = useState(true);

  // Template management (admin)
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: "", description: "" });
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<TemplateData | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/templates").then((r) => r.json()).catch(() => ({ templates: [] })),
      fetch("/api/settings/deadlines").then((r) => r.json()).catch(() => ({ deadlines: {} })),
    ])
      .then(([tmplData, deadlineData]) => {
        const mergedSettings = {
          ...DEADLINE_FALLBACKS,
          ...(deadlineData.deadlines || {}),
        };

        setTemplates(tmplData.templates || []);
        setSettings(mergedSettings);
        setEditForm(mergedSettings);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveDeadlines() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/deadlines", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({ deadlines: editForm }));
        const nextSettings = {
          ...DEADLINE_FALLBACKS,
          ...(data.deadlines || editForm),
        };
        setSettings(nextSettings);
        setEditForm(nextSettings);
        setEditing(false);
        showMsg(t("deadlines.saveSuccess"));
      } else {
        showMsg(t("deadlines.saveError"), "danger");
      }
    } catch {
      showMsg(t("deadlines.saveError"), "danger");
    }
    setSaving(false);
  }

  function showMsg(text: string, type: "success" | "danger" = "success") {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  }

  async function loadTemplates() {
    const res = await fetch("/api/templates");
    const data = await res.json();
    setTemplates(data.templates || []);
  }

  async function createTemplate() {
    if (!templateForm.name.trim() || !templateFile) return;
    setAddingTemplate(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateForm.name,
          description: templateForm.description || undefined,
          fileName: templateFile.name,
          mimeType: templateFile.type || "application/octet-stream",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        showMsg(data?.error || t("deadlines.templateCreateError"), "danger");
        setAddingTemplate(false);
        return;
      }

      try {
        const uploadRes = await fetch(data.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": templateFile.type || "application/octet-stream",
          },
          body: templateFile,
        });

        if (!uploadRes.ok) {
          await fetch(`/api/templates/${data.template.id}`, { method: "DELETE" }).catch(() => {});
          throw new Error(t("deadlines.templateUploadError"));
        }

        setTemplateForm({ name: "", description: "" });
        setTemplateFile(null);
        setShowAddTemplate(false);
        showMsg(t("deadlines.templateAdded"));
        loadTemplates();
      } catch {
        showMsg(t("deadlines.templateUploadError"), "danger");
      }
    } catch {
      showMsg(t("deadlines.templateCreateError"), "danger");
    }
    setAddingTemplate(false);
  }

  async function deleteTemplate(id: string) {
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    showMsg(t("deadlines.templateDeleted"));
    loadTemplates();
  }

  if (loading) {
    return <PageLoading label={t("deadlines.loading")} />;
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={!!templateToDelete}
        title={t("deadlines.deleteTemplateTitle")}
        description={
          templateToDelete
            ? t("deadlines.deleteTemplateDescription", { name: templateToDelete.name })
            : ""
        }
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        onCancel={() => setTemplateToDelete(null)}
        onConfirm={async () => {
          if (!templateToDelete) return;
          await deleteTemplate(templateToDelete.id);
          setTemplateToDelete(null);
        }}
      />

      <SectionTitle
        title={t("deadlines.title")}
        subtitle={t("deadlines.subtitle")}
        action={
          isAdmin && !editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />{t("deadlines.editSchedule")}
            </Button>
          ) : null
        }
      />

      {message && <Alert tone={messageType}>{message}</Alert>}

      {/* Admin: Edit deadlines inline */}
      {isAdmin && editing && (
        <Card accent="brand">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">{t("deadlines.editSchedule")}</h3>
              <button onClick={() => { setEditing(false); setEditForm(settings); }} className="text-ink-muted hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {deadlineDefaults.map((d) => (
                <div key={d.key} className="space-y-2">
                  <Field label={t("deadlines.label")}>
                    <Input value={editForm[d.labelKey] || d.defaultLabel} onChange={(e) => setEditForm({ ...editForm, [d.labelKey]: e.target.value })} placeholder={d.defaultLabel} />
                  </Field>
                  <Field label={t("deadlines.date")}>
                    <Input type="date" value={editForm[d.key] || ""} onChange={(e) => setEditForm({ ...editForm, [d.key]: e.target.value })} />
                  </Field>
                </div>
              ))}
            </div>
          </CardBody>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setEditing(false); setEditForm(settings); }}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={handleSaveDeadlines} loading={saving}><Save className="h-4 w-4" />{t("common.save")}</Button>
          </CardFooter>
        </Card>
      )}

      {/* ─── Timeline Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {deadlineDefaults.map((d) => {
          const date = settings[d.key];
          if (!date) return null;
          const isPast = new Date(date) <= new Date();
          const daysLeft = getDaysUntil(date);
          const Icon = d.icon;

          let borderColor = "border-blue-200";
          let bgColor = "bg-blue-50/50";
          let iconBg = "bg-blue-100 text-blue-600";
          let badgeTone: "success" | "warning" | "danger" | "info" | "neutral" = "info";

          if (isPast) {
            borderColor = "border-emerald-200";
            bgColor = "bg-emerald-50/50";
            iconBg = "bg-emerald-100 text-emerald-600";
            badgeTone = "success";
          } else if (daysLeft <= 7) {
            borderColor = "border-red-200";
            bgColor = "bg-red-50/50";
            iconBg = "bg-red-100 text-red-600";
            badgeTone = "danger";
          } else if (daysLeft <= 30) {
            borderColor = "border-amber-200";
            bgColor = "bg-amber-50/50";
            iconBg = "bg-amber-100 text-amber-600";
            badgeTone = "warning";
          }

          return (
            <div key={d.key} className={`rounded-xl border-2 ${borderColor} ${bgColor} p-4 transition-all hover:shadow-md`}>
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">{t("deadlines.step", { n: d.step })}</p>
                  <p className="text-sm font-semibold text-ink mt-0.5">{settings[d.labelKey] || d.defaultLabel}</p>
                  <p className="text-sm text-ink-light mt-1">{formatDate(date, locale)}</p>
                  <Badge tone={badgeTone} className="mt-2 text-xs">
                    {isPast ? t("deadlines.completed") : t("deadlines.daysLeft", { n: daysLeft })}
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Document Templates ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <FileText className="h-4 w-4" />{t("deadlines.documentTemplates")}
              <Badge tone="neutral" className="text-xs">{templates.length}</Badge>
            </h3>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setShowAddTemplate(!showAddTemplate)}>
                {showAddTemplate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {showAddTemplate ? t("common.cancel") : t("deadlines.addTemplate")}
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Admin: Add template form */}
        {isAdmin && showAddTemplate && (
          <div className="px-5 pb-4 border-b border-border">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_auto] gap-3">
              <div>
                <Input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder={t("deadlines.templateNamePlaceholder")}
                />
              </div>
              <div>
                <Input
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  placeholder={t("deadlines.templateDescriptionPlaceholder")}
                />
              </div>
              <div>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.svg,image/*"
                  onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                />
                {templateFile && (
                  <p className="mt-1 text-xs text-ink-muted truncate">{templateFile.name}</p>
                )}
              </div>
              <Button size="sm" onClick={createTemplate} loading={addingTemplate} disabled={!templateForm.name.trim() || !templateFile}>
                <Plus className="h-4 w-4" />{t("common.add")}
              </Button>
            </div>
          </div>
        )}

        <CardBody className="p-0">
          {templates.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<FileText className="h-12 w-12" />}
                title={t("deadlines.noTemplates")}
                body={isAdmin ? t("deadlines.noTemplatesDesc") : ""}
              />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {templates.map((tmpl) => (
                <div key={tmpl.id} className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-surface-hover/50 sm:flex-row sm:items-center group">
                  <div className="h-9 w-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                    <FileText className="h-4.5 w-4.5 text-brand-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{tmpl.name}</p>
                    {tmpl.description && <p className="text-xs text-ink-muted truncate">{tmpl.description}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 sm:shrink-0">
                    <a href={`/api/templates/${tmpl.id}/download`}>
                      <Button variant="outline" size="sm">
                        <Download className="h-3.5 w-3.5" />{t("common.download")}
                      </Button>
                    </a>
                    {isAdmin && (
                      <button
                        onClick={() => setTemplateToDelete(tmpl)}
                        className="p-1.5 rounded-lg text-ink-muted transition-colors hover:bg-red-50 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
                        title={t("common.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
