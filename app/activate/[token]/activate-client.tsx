"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

export function ActivateClient({
  token,
  initialStatus,
  initialUserName,
  initialEmail,
  initialError,
}: {
  token: string;
  initialStatus: "valid" | "error";
  initialUserName: string;
  initialEmail: string;
  initialError: string;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [status, setStatus] = useState<"valid" | "error" | "success">(initialStatus);
  const [userName] = useState(initialUserName);
  const [email] = useState(initialEmail);
  const [errorMsg, setErrorMsg] = useState(initialError);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 8) {
      setErrorMsg(t("activate.passwordMinLength"));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(t("activate.passwordMismatch"));
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
        setErrorMsg(data.error || t("login.genericError"));
      }
    } catch {
      setErrorMsg(t("activate.connectionError"));
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-50 via-white to-orange-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-brand-gradient items-center justify-center shadow-brand-glow mb-4">
            <span className="text-white font-bold text-2xl">D</span>
          </div>
          <h1 className="text-2xl font-bold text-ink">DPSTCon2026</h1>
          <p className="text-sm text-ink-muted mt-1">{t("activate.title")}</p>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-lg p-6">
          {status === "error" && (
            <div className="text-center py-8">
              <Alert tone="danger">{errorMsg}</Alert>
              <p className="mt-4 text-sm text-ink-muted">{t("activate.contactAdmin")}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/login")}>
                {t("activate.backToLogin")}
              </Button>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-8">
              <Alert tone="success">{t("activate.success")}</Alert>
            </div>
          )}

          {status === "valid" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="bg-surface-alt rounded-xl p-4 text-sm">
                <p className="text-ink-muted">{t("activate.name")}</p>
                <p className="font-medium text-ink">{userName}</p>
                <p className="text-ink-muted mt-2">{t("activate.email")}</p>
                <p className="font-medium text-ink">{email}</p>
              </div>

              {errorMsg && <Alert tone="danger">{errorMsg}</Alert>}

              <Field label={t("activate.setPassword")} required hint={t("activate.minChars")}>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("activate.enterPassword")} autoFocus />
              </Field>

              <Field label={t("activate.confirmPassword")} required>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t("activate.reenterPassword")} />
              </Field>

              <Button type="submit" className="w-full" loading={submitting} disabled={!password || !confirmPassword}>
                {t("activate.activateBtn")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
