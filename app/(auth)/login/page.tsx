"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const email = identifier.includes("@") ? identifier : `${identifier}@dpstcon.org`;
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(t("login.invalidCredentials"));
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError(t("login.genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      {/* Language toggle */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageToggle />
      </div>
      {/* Decorative */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-brand-500/15 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 items-center justify-center mb-5 shadow-2xl shadow-brand-500/40">
            <span className="text-white font-bold text-3xl">D</span>
          </div>
          <h1 className="text-3xl font-bold text-white">{t("login.title")}</h1>
          <p className="text-sm text-slate-400 mt-2">{t("login.subtitle")}</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <Alert tone="danger">{error}</Alert>}

            <Field label={t("login.usernameOrEmail")} htmlFor="identifier" required>
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t("login.usernamePlaceholder")}
                required
                autoComplete="username"
              />
            </Field>

            <Field label={t("login.password")} htmlFor="password" required>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </Field>

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              {t("common.signIn")}
            </Button>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-5">
            <div className="rounded-xl bg-gradient-to-r from-brand-50 to-amber-50 border border-brand-200 px-5 py-4">
              <p className="font-bold text-sm text-ink">{t("login.howToGetAccount")}</p>
              <p className="mt-1.5 text-xs text-ink-light leading-relaxed">
                {t("login.accountInfo")}
              </p>
              <p className="mt-1 text-xs text-ink-light leading-relaxed">
                {t("login.contactAdmin")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
