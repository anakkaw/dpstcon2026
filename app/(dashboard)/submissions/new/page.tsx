"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSubmission } from "@/server/actions/submission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";

interface Track {
  id: string;
  name: string;
  description: string | null;
}

export default function NewSubmissionPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    fetch("/api/submissions/tracks")
      .then((r) => r.json())
      .then((data) => setTracks(data.tracks || []))
      .catch(() => {});
  }, []);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const title = formData.get("title") as string;
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
        router.push(`/submissions/${result.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.genericError"));
    } finally {
      setLoading(false);
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

      {error && <Alert tone="danger">{error}</Alert>}

      <form action={handleSubmit}>
        <Card className="mb-4">
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink">{t("submissions.new.title")}</h3>
          </CardHeader>
          <CardBody className="space-y-4">
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
          </CardBody>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink">{t("submissions.new.advisor")}</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              {t("submissions.new.advisorDesc")}
            </p>
          </CardHeader>
          <CardBody>
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
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3">
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
      </form>
    </div>
  );
}
