"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

export default function ActivatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [status, setStatus] = useState<"loading" | "valid" | "error" | "success">("loading");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/activate/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setUserName(data.userName);
          setEmail(data.email);
          setStatus("valid");
        } else {
          setErrorMsg(data.error || "ลิงก์ไม่ถูกต้อง");
          setStatus("error");
        }
      })
      .catch(() => {
        setErrorMsg("เกิดข้อผิดพลาดในการตรวจสอบลิงก์");
        setStatus("error");
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 8) {
      setErrorMsg("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("รหัสผ่านไม่ตรงกัน");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/activate/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setErrorMsg(data.error || "เกิดข้อผิดพลาด");
      }
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-50 via-white to-orange-50">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-brand-gradient items-center justify-center shadow-brand-glow mb-4">
            <span className="text-white font-bold text-2xl">D</span>
          </div>
          <h1 className="text-2xl font-bold text-ink">DPSTCon2026</h1>
          <p className="text-sm text-ink-muted mt-1">เปิดใช้งานบัญชี</p>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-lg p-6">
          {status === "loading" && (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-ink-muted">กำลังตรวจสอบลิงก์...</span>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-8">
              <Alert tone="danger">{errorMsg}</Alert>
              <p className="mt-4 text-sm text-ink-muted">
                กรุณาติดต่อ Admin เพื่อขอลิงก์เชิญใหม่
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/login")}>
                กลับหน้าเข้าสู่ระบบ
              </Button>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-8">
              <Alert tone="success">เปิดใช้งานบัญชีสำเร็จ! กำลังไปหน้าเข้าสู่ระบบ...</Alert>
            </div>
          )}

          {status === "valid" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="bg-surface-alt rounded-xl p-4 text-sm">
                <p className="text-ink-muted">ชื่อ</p>
                <p className="font-medium text-ink">{userName}</p>
                <p className="text-ink-muted mt-2">อีเมล</p>
                <p className="font-medium text-ink">{email}</p>
              </div>

              {errorMsg && <Alert tone="danger">{errorMsg}</Alert>}

              <Field label="ตั้งรหัสผ่าน" required hint="อย่างน้อย 8 ตัวอักษร">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  autoFocus
                />
              </Field>

              <Field label="ยืนยันรหัสผ่าน" required>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                />
              </Field>

              <Button type="submit" className="w-full" loading={submitting} disabled={!password || !confirmPassword}>
                เปิดใช้งานบัญชี
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
