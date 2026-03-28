"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { displayNameTh } from "@/lib/display-name";
import type { AdvisorApprovalFileData, AdvisorApprovalSubmissionData } from "@/server/public-token-data";

export function AdvisorApprovalClient({
  token,
  initialSubmission,
  initialFiles,
  initialAlreadyResponded,
  initialResponseMessage,
  initialError,
}: {
  token: string;
  initialSubmission: AdvisorApprovalSubmissionData | null;
  initialFiles: AdvisorApprovalFileData[];
  initialAlreadyResponded: boolean;
  initialResponseMessage: string;
  initialError: string;
}) {
  const { t } = useI18n();

  const [submitting, setSubmitting] = useState(false);
  const [submission] = useState(initialSubmission);
  const [files] = useState(initialFiles);
  const [alreadyResponded] = useState(initialAlreadyResponded);
  const [responseMessage] = useState(initialResponseMessage);
  const [comments, setComments] = useState("");
  const [result, setResult] = useState<{ decision: string } | null>(null);
  const [error, setError] = useState(initialError);
  const [downloading, setDownloading] = useState("");

  async function handleDecision(decision: "APPROVED" | "REJECTED") {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/advisor-approval/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comments }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult({ decision: data.decision });
      }
    } catch {
      setError(t("login.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <Card className="max-w-lg w-full">
          <CardBody><Alert tone="danger">{error}</Alert></CardBody>
        </Card>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <Card className="max-w-lg w-full" accent={result.decision === "APPROVED" ? "success" : "danger"}>
          <CardBody className="text-center py-10">
            <div className={`inline-flex h-16 w-16 rounded-full items-center justify-center mb-4 ${result.decision === "APPROVED" ? "bg-emerald-100" : "bg-red-100"}`}>
              <span className="text-3xl">{result.decision === "APPROVED" ? "✓" : "✗"}</span>
            </div>
            <h2 className="text-xl font-bold text-ink tracking-tight mb-2">
              {result.decision === "APPROVED" ? t("advisor.approved") : t("advisor.rejected")}
            </h2>
            <p className="text-sm text-ink-muted">
              {result.decision === "APPROVED" ? t("advisor.approvedDesc") : t("advisor.rejectedDesc")}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (alreadyResponded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <Card className="max-w-lg w-full">
          <CardBody><Alert tone="info">{responseMessage}</Alert></CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 items-center justify-center mb-4 shadow-2xl shadow-brand-500/40">
            <span className="text-white font-bold text-2xl">D</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t("advisor.title")}</h1>
          <p className="text-xs text-slate-400 mt-1">{t("advisor.subtitle")}</p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">{t("advisor.paperInfo")}</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t("advisor.paperTitle")}</p>
              <p className="text-sm font-semibold text-ink mt-0.5">{submission?.title}</p>
            </div>
            {submission?.abstract && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t("advisor.abstract")}</p>
                <p className="text-sm text-ink whitespace-pre-wrap mt-0.5 leading-relaxed">{submission.abstract}</p>
              </div>
            )}
            {submission?.keywords && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t("advisor.keywords")}</p>
                <p className="text-sm text-ink mt-0.5">{submission.keywords}</p>
              </div>
            )}
            <div className="flex gap-8">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t("advisor.author")}</p>
                <p className="text-sm text-ink mt-0.5">{submission?.author ? displayNameTh(submission.author) : ""}</p>
                {submission?.author.affiliation && <p className="text-xs text-gray-500">{submission.author.affiliation}</p>}
              </div>
              {submission?.track && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t("advisor.track")}</p>
                  <Badge className="mt-0.5">{submission.track.name}</Badge>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {files.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-ink">{t("advisor.paperFiles")}</h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between bg-surface-alt rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg shrink-0">📄</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{file.originalName}</p>
                        <p className="text-xs text-ink-muted">
                          {file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={downloading === file.id}
                      onClick={async () => {
                        setDownloading(file.id);
                        try {
                          const res = await fetch(`/api/advisor-approval/${token}/download/${file.id}`);
                          const data = await res.json();
                          if (data.url) {
                            window.open(data.url, "_blank");
                          }
                        } catch {
                        } finally {
                          setDownloading("");
                        }
                      }}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-md hover:bg-brand-50 transition-colors shrink-0"
                    >
                      {downloading === file.id ? t("common.loading") : t("common.download")}
                    </button>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        <Card accent="brand">
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">{t("advisor.actionTitle")}</h2>
          </CardHeader>
          <CardBody>
            <Field label={t("advisor.comments")} htmlFor="comments">
              <Textarea id="comments" value={comments} onChange={(e) => setComments(e.target.value)} placeholder={t("advisor.commentsPlaceholder")} rows={3} />
            </Field>
          </CardBody>
          <CardFooter className="flex justify-end gap-3">
            <Button variant="danger" onClick={() => handleDecision("REJECTED")} loading={submitting}>{t("advisor.reject")}</Button>
            <Button onClick={() => handleDecision("APPROVED")} loading={submitting}>{t("advisor.approve")}</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
