"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/language-toggle";

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
    <div className="min-h-screen flex items-center justify-center bg-landing-hero text-slate-100 relative overflow-hidden px-4">
      {/* Background Decorative Glowing Orbs */}
      <div className="absolute -left-20 top-1/4 h-[450px] w-[450px] rounded-full bg-orange-500/5 blur-[100px] pointer-events-none animate-pulse-glow" />
      <div className="absolute right-1/4 top-10 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      {/* Language toggle */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageToggle className="text-slate-300 hover:text-white border-white/10 hover:bg-white/5 bg-white/3" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-[linear-gradient(135deg,#fb923c_0%,#f97316_52%,#c2410c_100%)] items-center justify-center mb-5 shadow-[0_0_20px_rgba(249,115,22,0.3)]">
            <span className="text-white font-bold text-3xl">D</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">{t("login.title")}</h1>
          <p className="text-sm text-slate-400 mt-2 font-medium">{t("login.subtitle")}</p>
        </div>

        {/* Form */}
        <div className="bg-white/2 rounded-2xl shadow-2xl p-8 border border-white/5 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3.5 text-sm text-red-200 animate-fade-in" role="alert">
                <div className="shrink-0 mt-0.5">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 leading-relaxed font-semibold">{error}</div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="identifier" className="block text-sm font-bold text-slate-300">
                {t("login.usernameOrEmail")}
                <span className="text-red-400 ml-0.5">*</span>
              </label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t("login.usernamePlaceholder")}
                required
                autoComplete="username"
                className="w-full rounded-xl border border-white/10 bg-white/3 px-4 py-2.5 text-sm text-white placeholder-slate-400 transition-all duration-200 hover:border-white/20 focus:outline-none focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-bold text-slate-300">
                {t("login.password")}
                <span className="text-red-400 ml-0.5">*</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/10 bg-white/3 px-4 py-2.5 text-sm text-white placeholder-slate-400 transition-all duration-200 hover:border-white/20 focus:outline-none focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center px-7 py-3 text-base font-bold bg-[linear-gradient(135deg,#fb923c_0%,#f97316_52%,#c2410c_100%)] text-white shadow-[0_0_15px_rgba(249,115,22,0.25)] rounded-xl border border-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {t("common.signIn")}
            </button>
          </form>

          <div className="mt-6 border-t border-white/5 pt-5">
            <div className="rounded-xl bg-gradient-to-r from-orange-500/5 to-amber-500/5 border border-orange-500/10 px-5 py-4 shadow-[0_0_15px_rgba(249,115,22,0.02)]">
              <p className="font-bold text-sm text-white">{t("login.howToGetAccount")}</p>
              <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                {t("login.accountInfo")}
              </p>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                {t("login.contactAdmin")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
