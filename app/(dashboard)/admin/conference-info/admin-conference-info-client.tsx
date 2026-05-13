"use client";

import { useRef, useState, type FormEvent } from "react";
import { Calendar, MapPin, Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ConferenceInfo } from "@/server/conference-info-data";

type Toast = { text: string; tone: "success" | "danger" } | null;

export function AdminConferenceInfoClient({
  initialInfo,
}: {
  initialInfo: ConferenceInfo;
}) {
  const [form, setForm] = useState<ConferenceInfo>(initialInfo);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function showToast(text: string, tone: "success" | "danger" = "success") {
    setToast({ text, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  function setLabel(
    field: keyof ConferenceInfo,
    lang: "th" | "en",
    value: string
  ) {
    setForm((s) => ({
      ...s,
      [field]: {
        ...s[field],
        [lang]: lang === "en" ? (value.trim() === "" ? null : value) : value,
      },
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Required-field check (matches the server zod schema)
    const missing: string[] = [];
    if (!form.dateLabel.th.trim()) missing.push("วันที่ (ไทย)");
    if (!form.venueName.th.trim()) missing.push("สถานที่ (ไทย)");
    if (!form.venueDetail.th.trim()) missing.push("รายละเอียดสถานที่ (ไทย)");
    if (missing.length > 0) {
      showToast(`กรุณากรอก: ${missing.join(", ")}`, "danger");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/conference-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed");
      }
      const data = await res.json();
      setForm(data.info);
      showToast("บันทึกข้อมูลงานประชุมแล้ว");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 uppercase tracking-wide">
          <Calendar className="h-3.5 w-3.5" />
          Admin
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold text-ink">
          ข้อมูลงานประชุม
        </h1>
        <p className="text-ink-muted text-sm max-w-2xl">
          แก้ไขข้อมูลที่แสดงบนหน้าแรกของ public site (
          <code className="text-xs px-1 py-0.5 bg-surface-2 rounded">
            /conference
          </code>
          ) — วันที่และสถานที่จัดงาน รองรับสองภาษา
        </p>
      </header>

      {toast && <Alert tone={toast.tone}>{toast.text}</Alert>}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardBody className="space-y-6">
            {/* Date */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <Calendar className="h-4 w-4 text-brand-600" />
                วันที่จัดงาน
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="ภาษาไทย" required>
                  <Input
                    value={form.dateLabel.th}
                    onChange={(e) =>
                      setLabel("dateLabel", "th", e.target.value)
                    }
                    placeholder="20 – 21 พ.ค. 2569"
                  />
                </Field>
                <Field label="ภาษาอังกฤษ">
                  <Input
                    value={form.dateLabel.en ?? ""}
                    onChange={(e) =>
                      setLabel("dateLabel", "en", e.target.value)
                    }
                    placeholder="20 – 21 May 2026"
                  />
                </Field>
              </div>
            </section>

            <hr className="border-border-light" />

            {/* Venue name */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <MapPin className="h-4 w-4 text-blue-600" />
                ชื่อสถานที่
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="ภาษาไทย" required>
                  <Input
                    value={form.venueName.th}
                    onChange={(e) =>
                      setLabel("venueName", "th", e.target.value)
                    }
                    placeholder="มหาวิทยาลัยนเรศวร"
                  />
                </Field>
                <Field label="ภาษาอังกฤษ">
                  <Input
                    value={form.venueName.en ?? ""}
                    onChange={(e) =>
                      setLabel("venueName", "en", e.target.value)
                    }
                    placeholder="Naresuan University"
                  />
                </Field>
              </div>
            </section>

            <hr className="border-border-light" />

            {/* Venue detail */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <MapPin className="h-4 w-4 text-blue-600" />
                รายละเอียดสถานที่
              </div>
              <p className="text-xs text-ink-muted -mt-1">
                บรรทัดที่สอง — เช่น คณะ/วิทยาเขต/เมือง
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="ภาษาไทย" required>
                  <Input
                    value={form.venueDetail.th}
                    onChange={(e) =>
                      setLabel("venueDetail", "th", e.target.value)
                    }
                    placeholder="คณะวิทยาศาสตร์ · พิษณุโลก"
                  />
                </Field>
                <Field label="ภาษาอังกฤษ">
                  <Input
                    value={form.venueDetail.en ?? ""}
                    onChange={(e) =>
                      setLabel("venueDetail", "en", e.target.value)
                    }
                    placeholder="Faculty of Science · Phitsanulok"
                  />
                </Field>
              </div>
            </section>

            <div className="pt-3 border-t border-border-light flex items-center justify-between gap-3">
              <p className="text-xs text-ink-muted">
                ช่อง <span className="font-semibold">ภาษาอังกฤษ</span>{" "}
                ว่างได้ — จะใช้ค่าภาษาไทยแทน
              </p>
              <Button type="submit" loading={saving}>
                <Save className="h-4 w-4 mr-1.5" />
                บันทึก
              </Button>
            </div>
          </CardBody>
        </Card>
      </form>
    </div>
  );
}
