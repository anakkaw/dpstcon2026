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

interface Track {
  id: string;
  name: string;
  description: string | null;
}

export default function NewSubmissionPage() {
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
      setError("กรุณากรอกชื่อบทความ");
      setLoading(false);
      return;
    }
    if (!trackId) {
      setError("กรุณาเลือกสาขาวิชา");
      setLoading(false);
      return;
    }
    if (!advisorName?.trim() || !advisorEmail?.trim()) {
      setError("กรุณาระบุชื่อและอีเมล Advisor");
      setLoading(false);
      return;
    }

    try {
      const result = await createSubmission(formData);
      if (result?.id) {
        router.push(`/submissions/${result.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumb
        items={[
          { label: "บทความ", href: "/submissions" },
          { label: "ส่งบทความใหม่" },
        ]}
      />

      <SectionTitle
        title="ส่งบทความใหม่"
        subtitle="กรอกข้อมูลบทความวิจัยของคุณ"
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <form action={handleSubmit}>
        <Card className="mb-4">
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink">ข้อมูลบทความ</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="ชื่อบทความ" htmlFor="title" required>
              <Input
                id="title"
                name="title"
                placeholder="กรอกชื่อบทความวิจัย"
                required
              />
            </Field>

            <Field
              label="สาขาวิชา"
              htmlFor="trackId"
              required
              hint="เลือกสาขาวิชาที่ตรงกับเนื้อหาบทความ"
            >
              <Select id="trackId" name="trackId" required>
                <option value="">— เลือกสาขาวิชา —</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.description ? ` — ${t.description}` : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="บทคัดย่อ (Abstract)"
              htmlFor="abstract"
              required
              hint="อธิบายเนื้อหาโดยย่อ"
            >
              <Textarea
                id="abstract"
                name="abstract"
                placeholder="กรอกบทคัดย่อ..."
                rows={6}
                required
              />
            </Field>

            <Field
              label="คำสำคัญ (Keywords)"
              htmlFor="keywords"
              hint="คั่นด้วยเครื่องหมายจุลภาค"
            >
              <Input
                id="keywords"
                name="keywords"
                placeholder="เช่น machine learning, deep learning, NLP"
              />
            </Field>
          </CardBody>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink">Advisor</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              ระบบจะส่งอีเมลแจ้ง Advisor เพื่อรับรองบทความก่อนเข้าสู่กระบวนการพิจารณา
            </p>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="ชื่อ Advisor" htmlFor="advisorName" required>
                <Input
                  id="advisorName"
                  name="advisorName"
                  placeholder="ชื่อ-นามสกุล"
                  required
                />
              </Field>
              <Field
                label="อีเมล Advisor"
                htmlFor="advisorEmail"
                required
                hint="ใช้สำหรับส่งอีเมลขอรับรอง"
              >
                <Input
                  id="advisorEmail"
                  name="advisorEmail"
                  type="email"
                  placeholder="advisor@university.ac.th"
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
            ยกเลิก
          </Button>
          <Button type="submit" loading={loading}>
            บันทึกแบบร่าง
          </Button>
        </div>
      </form>
    </div>
  );
}
