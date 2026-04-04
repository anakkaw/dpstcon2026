"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSubmission } from "@/server/actions/submission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/section-title";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Alert } from "@/components/ui/alert";
import { FileUpload } from "@/components/ui/file-upload";
import { FileList } from "@/components/ui/file-list";
import { WorkspaceSection, WorkspaceSurface } from "@/components/ui/workspace-section";
import { useI18n } from "@/lib/i18n";
import { useDashboardAuth } from "@/components/dashboard-auth-context";

interface Track {
  id: string;
  name: string;
  description: string | null;
}

interface DraftSummary {
  trackName: string;
  title: string;
  titleEn: string;
  advisorName: string;
  advisorEmail: string;
}

interface DraftFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: string;
  uploadedAt: string | Date;
}

export default function NewSubmissionPage() {
  const { t } = useI18n();
  const { roles } = useDashboardAuth();
  const router = useRouter();
  const canCreateSubmission = roles.includes("AUTHOR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);

  // After form submit: hold the created submission id and wait for file upload
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [draftFiles, setDraftFiles] = useState<DraftFile[]>([]);
  const [draftSummary, setDraftSummary] = useState<DraftSummary | null>(null);

  const hasUploadedManuscript = draftFiles.some((file) => file.kind === "MANUSCRIPT");

  useEffect(() => {
    if (!canCreateSubmission) {
      router.replace("/submissions");
      return;
    }

    fetch("/api/submissions/tracks")
      .then((r) => r.json())
      .then((data) => setTracks(data.tracks || []))
      .catch(() => {});
  }, [canCreateSubmission, router]);

  if (!canCreateSubmission) {
    return <Alert tone="danger">เฉพาะผู้ใช้ที่มีบทบาท Author เท่านั้นที่ส่งบทความใหม่ได้</Alert>;
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const title = formData.get("title") as string;
    const titleEn = formData.get("titleEn") as string;
    const trackId = formData.get("trackId") as string;
    const advisorName = formData.get("advisorName") as string;
    const advisorEmail = formData.get("advisorEmail") as string;

    if (!title?.trim()) {
      setError(t("submissions.new.requiredTitle"));
      setLoading(false);
      return;
    }
    if (!trackId) {
      setError(t("submissions.new.requiredTrack"));
      setLoading(false);
      return;
    }
    if (!advisorName?.trim() || !advisorEmail?.trim()) {
      setError(t("submissions.new.requiredAdvisor"));
      setLoading(false);
      return;
    }

    try {
      const result = await createSubmission(formData);
      if (result?.id) {
        // Transition to file upload step on the same page
        setSubmissionId(result.id);
        setDraftFiles([]);
        setDraftSummary({
          trackName: tracks.find((track) => track.id === trackId)?.name || t("submissions.new.track"),
          title: title.trim(),
          titleEn: titleEn?.trim(),
          advisorName: advisorName.trim(),
          advisorEmail: advisorEmail.trim(),
        });
        setError("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.genericError"));
    } finally {
      setLoading(false);
    }
  }

  // After file uploaded, navigate to submission detail
  function handleUploadComplete(file: DraftFile) {
    setDraftFiles((prev) => [...prev.filter((item) => item.id !== file.id), file]);
  }

  function handleContinue() {
    if (submissionId) {
      router.push(`/submissions/${submissionId}`);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumb
        items={[
          { label: t("nav.papers"), href: "/submissions" },
          { label: t("submissions.new.title") },
        ]}
      />

      <SectionTitle
        title={t("submissions.new.title")}
        subtitle={t("submissions.new.subtitle")}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StepCard
          number={1}
          title={t("submissions.new.stepDetailsTitle")}
          description={t("submissions.new.stepDetailsDesc")}
          status={submissionId ? "complete" : "active"}
        />
        <StepCard
          number={2}
          title={t("submissions.new.stepUploadTitle")}
          description={t("submissions.new.stepUploadDesc")}
          status={!submissionId ? "pending" : hasUploadedManuscript ? "complete" : "active"}
        />
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {/* ── Step 1: Form (hidden after draft is created) ── */}
      {!submissionId && (
        <form action={handleSubmit} className="space-y-6">
          <WorkspaceSection title={t("submissions.new.stepDetailsTitle")} description={t("submissions.new.stepDetailsDesc")}>
            <WorkspaceSurface className="p-5">
              <Field
                label={t("submissions.new.track")}
                htmlFor="trackId"
                required
                hint={t("submissions.new.trackDesc")}
              >
                <Select id="trackId" name="trackId" required>
                  <option value="">{t("submissions.new.trackPlaceholder")}</option>
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.description ? ` — ${t.description}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>

              {/* Paper Title — Bilingual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t("submissions.new.paperTitleTh")} htmlFor="title" required>
                  <Input
                    id="title"
                    name="title"
                    placeholder={t("submissions.new.paperTitleThPlaceholder")}
                    required
                  />
                </Field>
                <Field label={t("submissions.new.paperTitleEn")} htmlFor="titleEn" required>
                  <Input
                    id="titleEn"
                    name="titleEn"
                    placeholder={t("submissions.new.paperTitleEnPlaceholder")}
                    required
                  />
                </Field>
              </div>

              {/* Abstract — Bilingual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label={t("submissions.new.abstractTh")}
                  htmlFor="abstract"
                  required
                  hint={t("submissions.new.abstractDesc")}
                >
                  <Textarea
                    id="abstract"
                    name="abstract"
                    placeholder={t("submissions.new.abstractThPlaceholder")}
                    rows={6}
                    required
                  />
                </Field>
                <Field
                  label={t("submissions.new.abstractEn")}
                  htmlFor="abstractEn"
                  required
                >
                  <Textarea
                    id="abstractEn"
                    name="abstractEn"
                    placeholder={t("submissions.new.abstractEnPlaceholder")}
                    rows={6}
                    required
                  />
                </Field>
              </div>

              {/* Keywords — Bilingual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label={t("submissions.new.keywordsTh")}
                  htmlFor="keywords"
                  hint={t("submissions.new.keywordsDesc")}
                >
                  <Input
                    id="keywords"
                    name="keywords"
                    placeholder={t("submissions.new.keywordsThPlaceholder")}
                  />
                </Field>
                <Field
                  label={t("submissions.new.keywordsEn")}
                  htmlFor="keywordsEn"
                >
                  <Input
                    id="keywordsEn"
                    name="keywordsEn"
                    placeholder={t("submissions.new.keywordsEnPlaceholder")}
                  />
                </Field>
              </div>
            </WorkspaceSurface>
          </WorkspaceSection>

          <WorkspaceSection title={t("submissions.new.advisor")} description={t("submissions.new.advisorDesc")}>
            <WorkspaceSurface className="overflow-hidden">
              <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t("submissions.new.advisorName")} htmlFor="advisorName" required>
                  <Input
                    id="advisorName"
                    name="advisorName"
                    placeholder={t("submissions.new.advisorNamePlaceholder")}
                    required
                  />
                </Field>
                <Field
                  label={t("submissions.new.advisorEmail")}
                  htmlFor="advisorEmail"
                  required
                  hint={t("submissions.new.advisorEmailDesc")}
                >
                  <Input
                    id="advisorEmail"
                    name="advisorEmail"
                    type="email"
                    placeholder={t("submissions.new.advisorEmailPlaceholder")}
                    required
                  />
                </Field>
              </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-border-light bg-surface-alt/40 px-5 py-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.back()}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" loading={loading}>
                  {t("submissions.new.saveDraft")}
                </Button>
              </div>
            </WorkspaceSurface>
          </WorkspaceSection>
        </form>
      )}

      {/* ── Step 2: File upload (shown after draft is created) ── */}
      {submissionId && (
        <div className="space-y-4">
          <Alert tone="success">{t("submissions.new.draftSavedNotice")}</Alert>

          {draftSummary && (
            <WorkspaceSection title={t("submissions.new.savedDraftTitle")} description={t("submissions.new.savedDraftDesc")}>
              <WorkspaceSurface className="p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <SummaryField label={t("submissions.new.track")} value={draftSummary.trackName} />
                  <SummaryField label={t("submissions.new.advisorName")} value={draftSummary.advisorName} />
                  <SummaryField label={t("submissions.new.paperTitleTh")} value={draftSummary.title} />
                  <SummaryField label={t("submissions.new.advisorEmail")} value={draftSummary.advisorEmail} />
                  <div className="sm:col-span-2">
                    <SummaryField label={t("submissions.new.paperTitleEn")} value={draftSummary.titleEn} />
                  </div>
                </div>
              </WorkspaceSurface>
            </WorkspaceSection>
          )}

          <WorkspaceSection title={t("submissions.new.attachManuscript")} description={t("submissions.new.attachManuscriptDesc")}>
            <WorkspaceSurface className="overflow-hidden">
              <div className="space-y-4 p-5">
                <FileUpload
                  submissionId={submissionId}
                  kind="MANUSCRIPT"
                  onUploadComplete={handleUploadComplete}
                />
                {draftFiles.length > 0 && (
                  <FileList
                    submissionId={submissionId}
                    files={draftFiles}
                    canDelete
                    onDeleteComplete={(fileId) => {
                      setDraftFiles((prev) => prev.filter((file) => file.id !== fileId));
                    }}
                  />
                )}
              </div>
              <div className="border-t border-border-light bg-surface-alt/40 px-5 py-4">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-ink-muted">
                    {hasUploadedManuscript
                      ? t("submissions.new.fileUploadedReady")
                      : t("submissions.new.uploadRequired")}
                  </p>
                  <div className="flex w-full justify-end gap-3 sm:w-auto">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => router.push("/submissions")}
                    >
                      {t("nav.papers")}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleContinue}
                      disabled={!hasUploadedManuscript}
                    >
                      {t("submissions.new.continueToDetail")}
                    </Button>
                  </div>
                </div>
              </div>
            </WorkspaceSurface>
          </WorkspaceSection>
        </div>
      )}
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
  status,
}: {
  number: number;
  title: string;
  description: string;
  status: "pending" | "active" | "complete";
}) {
  const styles = {
    pending: {
      badge: "border-border bg-surface-alt text-ink-muted",
      card: "border-border bg-surface",
      title: "text-ink",
      desc: "text-ink-muted",
    },
    active: {
      badge: "border-brand-200 bg-brand-50 text-brand-700",
      card: "border-brand-200 bg-brand-50/40",
      title: "text-brand-700",
      desc: "text-brand-600/80",
    },
    complete: {
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      card: "border-emerald-200 bg-emerald-50/50",
      title: "text-emerald-700",
      desc: "text-emerald-700/75",
    },
  }[status];

  return (
    <div className={`rounded-xl border px-4 py-3 ${styles.card}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${styles.badge}`}>
          {number}
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${styles.title}`}>{title}</p>
          <p className={`mt-1 text-xs ${styles.desc}`}>{description}</p>
        </div>
      </div>
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-1 text-sm text-ink">{value || "—"}</p>
    </div>
  );
}
