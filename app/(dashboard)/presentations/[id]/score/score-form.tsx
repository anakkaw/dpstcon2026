"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { displayNameTh } from "@/lib/display-name";
import { formatDateTime } from "@/lib/utils";
import type { PresentationRubricCriterion } from "@/server/presentation-rubrics";
import {
  CheckCircle2,
  Clock,
  MapPin,
  Mic,
  Image as ImageIcon,
  Save,
  Sparkles,
  MessageSquare,
  ArrowLeft,
  ArrowRight,
  Star,
  ExternalLink,
  History,
} from "lucide-react";

interface PresentationProps {
  id: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  room: string | null;
  duration: number | null;
  submission: {
    id: string;
    paperCode: string | null;
    title: string;
    author: {
      name: string;
      prefixTh: string | null;
      firstNameTh: string | null;
      lastNameTh: string | null;
      prefixEn: string | null;
      firstNameEn: string | null;
      lastNameEn: string | null;
    };
    track: { id: string; name: string } | null;
  };
}

interface ScoreFormProps {
  presentation: PresentationProps;
  criteria: PresentationRubricCriterion[];
  initialScores: Record<string, number> | null;
  initialComments: string;
  hasExisting: boolean;
  lastSavedAt: string | null;
  nextPendingId: string | null;
}

const LEVEL_COLORS: Record<number, { bg: string; border: string; text: string; dot: string }> = {
  5: { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-700", dot: "bg-emerald-500" },
  4: { bg: "bg-blue-50", border: "border-blue-400", text: "text-blue-700", dot: "bg-blue-500" },
  3: { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-700", dot: "bg-amber-500" },
  2: { bg: "bg-orange-50", border: "border-orange-400", text: "text-orange-700", dot: "bg-orange-500" },
  1: { bg: "bg-red-50", border: "border-red-400", text: "text-red-700", dot: "bg-red-500" },
};

function earnedPoints(level: number, totalPoints: number): number {
  return Math.round((level / 5) * totalPoints);
}

export function ScoreForm({
  presentation,
  criteria: rawCriteria,
  initialScores,
  initialComments,
  hasExisting,
  lastSavedAt,
  nextPendingId,
}: ScoreFormProps) {
  const { t, locale } = useI18n();
  const router = useRouter();

  // Filter out zero-point criteria (not applicable)
  const criteria = useMemo(
    () => rawCriteria.filter((c) => c.totalPoints > 0),
    [rawCriteria]
  );

  const initialLevels: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    if (initialScores) {
      for (const criterion of criteria) {
        const stored = initialScores[criterion.id];
        if (typeof stored === "number" && criterion.totalPoints > 0) {
          const ratio = stored / criterion.totalPoints;
          const level = Math.max(1, Math.min(5, Math.round(ratio * 5)));
          map[criterion.id] = level;
        }
      }
    }
    return map;
  }, [criteria, initialScores]);

  const [levels, setLevels] = useState<Record<string, number>>(initialLevels);
  const [comments, setComments] = useState(initialComments);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const totalMax = useMemo(
    () => criteria.reduce((sum, c) => sum + c.totalPoints, 0),
    [criteria]
  );
  const totalEarned = useMemo(
    () =>
      criteria.reduce((sum, c) => {
        const level = levels[c.id];
        return level ? sum + earnedPoints(level, c.totalPoints) : sum;
      }, 0),
    [criteria, levels]
  );
  const completedCount = useMemo(
    () => criteria.filter((c) => levels[c.id]).length,
    [criteria, levels]
  );
  const allCompleted = completedCount === criteria.length && criteria.length > 0;
  const progressPct = criteria.length > 0 ? Math.round((completedCount / criteria.length) * 100) : 0;

  // Warn on unload when there are unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const setLevel = useCallback((criterionId: string, level: number) => {
    setLevels((prev) => ({ ...prev, [criterionId]: level }));
    setDirty(true);
  }, []);

  async function handleSubmit() {
    if (!allCompleted) return;
    setSaving(true);
    setMessage(null);

    const scores: Record<string, number> = {};
    for (const criterion of criteria) {
      const level = levels[criterion.id];
      if (level) {
        scores[criterion.id] = earnedPoints(level, criterion.totalPoints);
      }
    }

    try {
      const response = await fetch(`/api/presentations/${presentation.id}/evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores, comments: comments.trim() || undefined }),
      });

      if (response.ok) {
        setMessage({ tone: "success", text: t("scoring.saved") });
        setDirty(false);
        router.refresh();
      } else {
        const data = await response.json().catch(() => null);
        setMessage({ tone: "danger", text: data?.error || t("scoring.saveError") });
      }
    } catch {
      setMessage({ tone: "danger", text: t("scoring.saveError") });
    }
    setSaving(false);
  }

  const scorePercent = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
  const scoreTone =
    scorePercent >= 80
      ? "text-emerald-600"
      : scorePercent >= 60
        ? "text-blue-600"
        : scorePercent >= 40
          ? "text-amber-600"
          : "text-red-600";

  const TypeIcon = presentation.type === "ORAL" ? Mic : ImageIcon;

  return (
    <div className="space-y-6 pb-36 lg:pb-32">
      <Breadcrumb
        items={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("scoring.hubTitle"), href: "/presentations/scoring" },
          { label: t("scoring.title") },
        ]}
      />

      {/* ── Paper header ── */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={presentation.type === "ORAL" ? "info" : "neutral"}>
              <TypeIcon className="h-3 w-3" />
              {presentation.type === "ORAL"
                ? t("presentations.oral")
                : t("presentations.poster")}
            </Badge>
            {presentation.submission.paperCode && (
              <Badge>{presentation.submission.paperCode}</Badge>
            )}
            {presentation.submission.track && (
              <Badge tone="info">{presentation.submission.track.name}</Badge>
            )}
            {hasExisting && (
              <Badge tone="success">
                <CheckCircle2 className="h-3 w-3" />
                {t("scoring.submitted")}
              </Badge>
            )}
          </div>

          <div>
            <h1 className="text-xl font-semibold leading-snug text-ink sm:text-2xl">
              {presentation.submission.title}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {displayNameTh(presentation.submission.author)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            {presentation.scheduledAt && (
              <div className="flex items-center gap-2 rounded-lg bg-surface-alt px-3 py-2 text-ink">
                <Clock className="h-4 w-4 text-ink-muted" />
                {formatDateTime(presentation.scheduledAt)}
              </div>
            )}
            {presentation.room && (
              <div className="flex items-center gap-2 rounded-lg bg-surface-alt px-3 py-2 text-ink">
                <MapPin className="h-4 w-4 text-ink-muted" />
                {presentation.room}
              </div>
            )}
            {presentation.duration && (
              <div className="flex items-center gap-2 rounded-lg bg-surface-alt px-3 py-2 text-ink">
                <Sparkles className="h-4 w-4 text-ink-muted" />
                {presentation.duration} {t("presentations.minutes")}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <a
              href={`/submissions/${presentation.submission.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="secondary">
                <ExternalLink className="h-3.5 w-3.5" />
                {t("scoring.viewPaper")}
              </Button>
            </a>
          </div>

          {hasExisting && lastSavedAt && (
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <History className="h-3 w-3" />
              {t("scoring.lastSaved", { date: formatDateTime(lastSavedAt) })}
            </p>
          )}
        </CardBody>
      </Card>

      {/* ── Score summary / progress ── */}
      <Card accent={allCompleted ? "success" : "info"}>
        <CardBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {t("scoring.totalScore")}
              </p>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold tabular-nums ${scoreTone}`}>
                  {totalEarned}
                </span>
                <span className="text-lg text-ink-muted">/ {totalMax}</span>
                <span className={`text-sm font-medium ${scoreTone}`}>({scorePercent}%)</span>
              </div>
              <p className="text-xs text-ink-muted" aria-live="polite">
                {t("scoring.completedCount", { n: completedCount, total: criteria.length })}
              </p>
            </div>
            <div className="w-full sm:w-64">
              <div className="mb-1 flex items-center justify-between text-xs text-ink-muted">
                <span>{t("scoring.progress")}</span>
                <span className="font-medium tabular-nums">{progressPct}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-gray-100"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    allCompleted ? "bg-emerald-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {/* ── Criteria ── */}
      <div className="space-y-4">
        {criteria.map((criterion, index) => (
          <CriterionCard
            key={criterion.id}
            criterion={criterion}
            index={index}
            locale={locale}
            selectedLevel={levels[criterion.id]}
            onSelect={(level) => setLevel(criterion.id, level)}
            labelMax={t("scoring.maxPoints")}
            labelPoints={t("scoring.points")}
          />
        ))}
      </div>

      {/* ── Comments ── */}
      <Card>
        <CardHeader>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <MessageSquare className="h-4 w-4 text-ink-muted" />
            {t("scoring.commentsTitle")}
          </h3>
          <p className="text-xs text-ink-muted">{t("scoring.commentsHint")}</p>
        </CardHeader>
        <CardBody>
          <Textarea
            value={comments}
            onChange={(e) => {
              setComments(e.target.value);
              setDirty(true);
            }}
            placeholder={t("scoring.commentsPlaceholder")}
            rows={5}
          />
        </CardBody>
      </Card>

      {/* ── Sticky footer ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.12)] backdrop-blur lg:ml-60">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">
                {allCompleted
                  ? t("scoring.readyToSubmit")
                  : t("scoring.completeAll", { n: criteria.length - completedCount })}
              </p>
              <p className={`text-lg font-bold tabular-nums leading-tight ${scoreTone}`}>
                {totalEarned}
                <span className="text-sm font-normal text-ink-muted"> / {totalMax}</span>
                <span className="ml-2 text-xs font-medium text-ink-muted">
                  ({completedCount}/{criteria.length})
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => router.push("/presentations/scoring")}
              size="sm"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("common.back")}
            </Button>
            <Button
              onClick={handleSubmit}
              loading={saving}
              disabled={!allCompleted}
              size="sm"
            >
              <Save className="h-4 w-4" />
              {hasExisting ? t("scoring.update") : t("scoring.submit")}
            </Button>
            {nextPendingId && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push(`/presentations/${nextPendingId}/score`)}
              >
                {t("scoring.next")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CriterionCard({
  criterion,
  index,
  locale,
  selectedLevel,
  onSelect,
  labelMax,
  labelPoints,
}: {
  criterion: PresentationRubricCriterion;
  index: number;
  locale: string;
  selectedLevel: number | undefined;
  onSelect: (level: number) => void;
  labelMax: string;
  labelPoints: string;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const name = locale === "en" ? criterion.nameEn : criterion.nameTh;
  const description = locale === "en" ? criterion.descriptionEn : criterion.descriptionTh;
  const earned = selectedLevel ? earnedPoints(selectedLevel, criterion.totalPoints) : 0;

  // Levels are ordered 5,4,3,2,1 in the rubric source
  const orderedLevels = criterion.levels;

  const handleKeyDown = (event: React.KeyboardEvent, currentLevel: number) => {
    const navKeys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    const visibleOrder = [...orderedLevels].sort((a, b) => a.level - b.level);

    // Digit shortcut: 1-5 jumps straight to that level
    if (/^[1-5]$/.test(event.key)) {
      event.preventDefault();
      const digit = Number(event.key) as 1 | 2 | 3 | 4 | 5;
      onSelect(digit);
      requestAnimationFrame(() => {
        const nextButton = groupRef.current?.querySelector<HTMLButtonElement>(
          `[data-level="${digit}"]`
        );
        nextButton?.focus();
      });
      return;
    }

    if (!navKeys.includes(event.key)) return;
    event.preventDefault();

    const currentIndex = visibleOrder.findIndex((l) => l.level === currentLevel);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = Math.min(visibleOrder.length - 1, currentIndex + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = visibleOrder.length - 1;
    }

    const nextLevel = visibleOrder[nextIndex].level;
    onSelect(nextLevel);

    requestAnimationFrame(() => {
      const nextButton = groupRef.current?.querySelector<HTMLButtonElement>(
        `[data-level="${nextLevel}"]`
      );
      nextButton?.focus();
    });
  };

  const focusableLevel = selectedLevel ?? 3; // center-level default

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                selectedLevel
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-ink-muted"
              }`}
            >
              {selectedLevel ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-ink">{name}</h3>
              {description && (
                <p className="mt-1 text-sm text-ink-muted">{description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 pl-11 sm:pl-0">
            <div className="rounded-lg bg-surface-alt px-3 py-1.5 text-xs">
              <span className="text-ink-muted">{labelMax} </span>
              <span className="font-semibold text-ink">{criterion.totalPoints}</span>
            </div>
            {selectedLevel && (
              <div
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${LEVEL_COLORS[selectedLevel].bg} ${LEVEL_COLORS[selectedLevel].text}`}
              >
                {earned}/{criterion.totalPoints}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <div
          ref={groupRef}
          role="radiogroup"
          aria-label={name}
          className="grid grid-cols-1 gap-2 sm:grid-cols-5"
        >
          {[...orderedLevels]
            .sort((a, b) => a.level - b.level)
            .map((level) => {
              const selected = selectedLevel === level.level;
              const colors = LEVEL_COLORS[level.level];
              const title = locale === "en" ? level.titleEn : level.titleTh;
              const desc = locale === "en" ? level.descriptionEn : level.descriptionTh;
              const levelEarned = earnedPoints(level.level, criterion.totalPoints);
              const isTabStop = selected || (!selectedLevel && level.level === focusableLevel);

              return (
                <button
                  key={level.level}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={isTabStop ? 0 : -1}
                  data-level={level.level}
                  onClick={() => onSelect(level.level)}
                  onKeyDown={(event) => handleKeyDown(event, level.level)}
                  className={`group relative flex flex-col gap-2 rounded-xl border-2 p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 ${
                    selected
                      ? `${colors.border} ${colors.bg} shadow-sm`
                      : "border-gray-200 bg-white hover:border-gray-300 hover:bg-surface-alt"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${colors.dot}`}
                      >
                        {level.level}
                      </div>
                      <span
                        className={`text-xs font-semibold ${selected ? colors.text : "text-ink"}`}
                      >
                        {title}
                      </span>
                    </div>
                    {selected && <CheckCircle2 className={`h-4 w-4 ${colors.text}`} />}
                  </div>
                  <p className="text-xs leading-relaxed text-ink-muted line-clamp-3 group-hover:line-clamp-none">
                    {desc}
                  </p>
                  <div className="mt-auto flex items-center gap-1 pt-1 text-[11px]">
                    <Star
                      className={`h-3 w-3 ${selected ? colors.text : "text-ink-muted"}`}
                    />
                    <span
                      className={`font-semibold tabular-nums ${selected ? colors.text : "text-ink-muted"}`}
                    >
                      {levelEarned} {labelPoints}
                    </span>
                  </div>
                </button>
              );
            })}
        </div>
      </CardBody>
    </Card>
  );
}
