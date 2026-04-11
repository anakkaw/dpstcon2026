"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import type { CriterionData } from "@/server/presentation-data";
import { cn } from "@/lib/utils";
import { ChevronDown, ClipboardList, PencilLine } from "lucide-react";

/* ── Color palette for rubric levels 1–5 ── */
const levelColors: Record<number, { bg: string; border: string; badge: string; dot: string }> = {
  1: { bg: "bg-red-50/60", border: "border-red-200/60", badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-400" },
  2: { bg: "bg-amber-50/60", border: "border-amber-200/60", badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-400" },
  3: { bg: "bg-yellow-50/60", border: "border-yellow-200/60", badge: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-400" },
  4: { bg: "bg-blue-50/60", border: "border-blue-200/60", badge: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-400" },
  5: { bg: "bg-emerald-50/60", border: "border-emerald-200/60", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
};

const defaultLevelColor = { bg: "bg-gray-50", border: "border-gray-200/60", badge: "bg-gray-100 text-gray-700 border-gray-200", dot: "bg-gray-400" };

function getLevelColor(level: number) {
  return levelColors[level] || defaultLevelColor;
}

interface RubricManagerProps {
  criteria: CriterionData[];
  canEdit?: boolean;
  onSave?: (criteria: CriterionData[]) => Promise<void>;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function RubricManager({
  criteria,
  canEdit = false,
  onSave,
  collapsible = true,
  defaultExpanded = true,
}: RubricManagerProps) {
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState<CriterionData[]>(criteria);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();

  /** Pick Thai or English text based on current locale */
  const loc = <T extends { nameTh: string; nameEn: string }>(item: T): string =>
    locale === "en" ? item.nameEn : item.nameTh;

  const locDesc = <T extends { descriptionTh: string; descriptionEn: string }>(item: T): string =>
    locale === "en" ? item.descriptionEn : item.descriptionTh;

  const locTitle = <T extends { titleTh: string; titleEn: string }>(item: T): string =>
    locale === "en" ? item.titleEn : item.titleTh;

  const locTitleDesc = <T extends { titleTh: string; titleEn: string; descriptionTh: string; descriptionEn: string }>(item: T) => ({
    title: locale === "en" ? item.titleEn : item.titleTh,
    description: locale === "en" ? item.descriptionEn : item.descriptionTh,
  });

  useEffect(() => {
    setDraft(criteria);
  }, [criteria]);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const items = editing ? draft : criteria;
  const showDetails = !collapsible || expanded || editing;
  const totalPoints = items.reduce((sum, c) => sum + c.totalPoints, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {collapsible ? (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                disabled={editing}
                aria-expanded={showDetails}
                aria-controls={panelId}
                aria-label={
                  showDetails ? t("presentations.rubricHideDetails") : t("presentations.rubricShowDetails")
                }
                title={
                  showDetails ? t("presentations.rubricHideDetails") : t("presentations.rubricShowDetails")
                }
                className={cn(
                  "mt-0.5 shrink-0 rounded-lg p-1 text-ink-muted transition-colors",
                  "hover:bg-surface-hover hover:text-ink",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                  editing && "cursor-not-allowed opacity-40"
                )}
              >
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-200", showDetails && "rotate-180")}
                  aria-hidden
                />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ClipboardList className="h-4 w-4 shrink-0" />
                {t("presentations.rubricTitle")}
                {items.length > 0 && (
                  <span className="text-xs font-medium text-ink-muted">
                    ({items.length} {t("presentations.criteria").toLowerCase()} / {totalPoints} {t("presentations.totalPoints").toLowerCase()})
                  </span>
                )}
              </h3>
              {showDetails ? (
                <p className="mt-1 text-sm text-ink-muted">
                  {t("presentations.rubricSubtitle")}
                </p>
              ) : null}
            </div>
          </div>
          {canEdit ? (
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setDraft(criteria);
                      setEditing(false);
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button size="sm" onClick={handleSave} loading={saving}>
                    {t("presentations.saveRubric")}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setExpanded(true);
                    setEditing(true);
                  }}
                >
                  <PencilLine className="h-3.5 w-3.5" />
                  {t("presentations.editRubric")}
                </Button>
              )}
            </div>
          ) : null}
        </div>

        {/* ── Compact summary bar when collapsed ── */}
        {!showDetails && items.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {items.map((criterion) => (
              <button
                key={criterion.id}
                type="button"
                onClick={() => setExpanded(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface-alt px-2.5 py-1.5 text-xs transition-colors hover:bg-surface-hover"
              >
                <span className="font-medium text-ink">{loc(criterion)}</span>
                <span className="rounded-md bg-brand-100/80 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                  {criterion.totalPoints}
                </span>
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      {showDetails ? (
      <CardBody id={panelId} className="space-y-4">
        {items.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-10 w-10" />}
            title={t("presentations.noCriteria")}
            body={t("presentations.noCriteriaDesc")}
          />
        ) : (
          items.map((criterion, criterionIndex) => (
            <div
              key={criterion.id}
              className="rounded-2xl border border-border/60 bg-surface-alt p-4"
            >
              {editing ? (
                /* ── EDIT MODE: show both languages ── */
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label={`${t("presentations.criteriaName")} (${t("presentations.thaiLabel")})`}>
                      <Input
                        value={criterion.nameTh}
                        onChange={(e) =>
                          setDraft((current) =>
                            current.map((item, index) =>
                              index === criterionIndex
                                ? { ...item, nameTh: e.target.value }
                                : item
                            )
                          )
                        }
                      />
                    </Field>
                    <Field label={`${t("presentations.criteriaName")} (${t("presentations.englishLabel")})`}>
                      <Input
                        value={criterion.nameEn}
                        onChange={(e) =>
                          setDraft((current) =>
                            current.map((item, index) =>
                              index === criterionIndex
                                ? { ...item, nameEn: e.target.value }
                                : item
                            )
                          )
                        }
                      />
                    </Field>
                    <Field label={`${t("presentations.criteriaDesc")} (${t("presentations.thaiLabel")})`}>
                      <Textarea
                        rows={3}
                        value={criterion.descriptionTh}
                        onChange={(e) =>
                          setDraft((current) =>
                            current.map((item, index) =>
                              index === criterionIndex
                                ? { ...item, descriptionTh: e.target.value }
                                : item
                            )
                          )
                        }
                      />
                    </Field>
                    <Field label={`${t("presentations.criteriaDesc")} (${t("presentations.englishLabel")})`}>
                      <Textarea
                        rows={3}
                        value={criterion.descriptionEn}
                        onChange={(e) =>
                          setDraft((current) =>
                            current.map((item, index) =>
                              index === criterionIndex
                                ? { ...item, descriptionEn: e.target.value }
                                : item
                            )
                          )
                        }
                      />
                    </Field>
                  </div>
                  <Field label={t("presentations.totalPoints")}>
                    <Input
                      type="number"
                      min={1}
                      value={criterion.totalPoints}
                      onChange={(e) =>
                        setDraft((current) =>
                          current.map((item, index) =>
                            index === criterionIndex
                              ? {
                                  ...item,
                                  totalPoints: Number(e.target.value || 0),
                                }
                              : item
                          )
                        )
                      }
                    />
                  </Field>
                  <div className="space-y-3">
                    {criterion.levels.map((level, levelIndex) => {
                      const color = getLevelColor(level.level);
                      return (
                        <div
                          key={`${criterion.id}-${level.level}`}
                          className={cn("rounded-xl border p-3", color.bg, color.border)}
                        >
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", color.badge)}>
                              {t("presentations.levelLabel", { n: level.level })}
                            </span>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <Field label={`${t("presentations.levelTitle")} (${t("presentations.thaiLabel")})`}>
                              <Input
                                value={level.titleTh}
                                onChange={(e) =>
                                  setDraft((current) =>
                                    current.map((item, index) =>
                                      index === criterionIndex
                                        ? {
                                            ...item,
                                            levels: item.levels.map((value, idx) =>
                                              idx === levelIndex
                                                ? { ...value, titleTh: e.target.value }
                                                : value
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }
                              />
                            </Field>
                            <Field label={`${t("presentations.levelTitle")} (${t("presentations.englishLabel")})`}>
                              <Input
                                value={level.titleEn}
                                onChange={(e) =>
                                  setDraft((current) =>
                                    current.map((item, index) =>
                                      index === criterionIndex
                                        ? {
                                            ...item,
                                            levels: item.levels.map((value, idx) =>
                                              idx === levelIndex
                                                ? { ...value, titleEn: e.target.value }
                                                : value
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }
                              />
                            </Field>
                            <Field label={`${t("presentations.levelDescriptor")} (${t("presentations.thaiLabel")})`}>
                              <Textarea
                                rows={3}
                                value={level.descriptionTh}
                                onChange={(e) =>
                                  setDraft((current) =>
                                    current.map((item, index) =>
                                      index === criterionIndex
                                        ? {
                                            ...item,
                                            levels: item.levels.map((value, idx) =>
                                              idx === levelIndex
                                                ? {
                                                    ...value,
                                                    descriptionTh: e.target.value,
                                                  }
                                                : value
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }
                              />
                            </Field>
                            <Field label={`${t("presentations.levelDescriptor")} (${t("presentations.englishLabel")})`}>
                              <Textarea
                                rows={3}
                                value={level.descriptionEn}
                                onChange={(e) =>
                                  setDraft((current) =>
                                    current.map((item, index) =>
                                      index === criterionIndex
                                        ? {
                                            ...item,
                                            levels: item.levels.map((value, idx) =>
                                              idx === levelIndex
                                                ? {
                                                    ...value,
                                                    descriptionEn: e.target.value,
                                                  }
                                                : value
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }
                              />
                            </Field>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* ── READ MODE: single-language, compact table layout ── */
                <div className="space-y-3">
                  {/* Criterion header */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-ink">{loc(criterion)}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{locDesc(criterion)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-200/60 bg-brand-50/60 px-3 py-1.5">
                      <span className="text-lg font-bold text-brand-600">{criterion.totalPoints}</span>
                      <span className="text-xs font-medium text-brand-500">{t("presentations.totalPoints").toLowerCase()}</span>
                    </div>
                  </div>

                  {/* Levels — compact horizontal table on desktop */}
                  <div className="hidden overflow-x-auto rounded-xl border border-border/50 sm:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/40 bg-surface-alt/80">
                          {criterion.levels.map((level) => {
                            const color = getLevelColor(level.level);
                            return (
                              <th
                                key={`${criterion.id}-h-${level.level}`}
                                className="px-3 py-2 text-center"
                                style={{ width: `${100 / criterion.levels.length}%` }}
                              >
                                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold", color.badge)}>
                                  <span className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
                                  {t("presentations.levelLabel", { n: level.level })}
                                </span>
                              </th>
                            );
                          })}
                        </tr>
                        <tr className="border-b border-border/40">
                          {criterion.levels.map((level) => (
                            <th
                              key={`${criterion.id}-t-${level.level}`}
                              className="px-3 py-1.5 text-center text-xs font-semibold text-ink"
                            >
                              {locTitle(level)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {criterion.levels.map((level) => {
                            const { description } = locTitleDesc(level);
                            return (
                              <td
                                key={`${criterion.id}-d-${level.level}`}
                                className="border-r border-border/30 px-3 py-2.5 align-top text-xs leading-relaxed text-ink-light last:border-r-0"
                              >
                                {description}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile fallback: stacked cards (hidden on desktop) */}
                  <div className="space-y-2 sm:hidden">
                    {criterion.levels.map((level) => {
                      const color = getLevelColor(level.level);
                      const { title, description } = locTitleDesc(level);
                      return (
                        <div
                          key={`${criterion.id}-m-${level.level}`}
                          className={cn("flex gap-3 rounded-lg border p-2.5", color.bg, color.border)}
                        >
                          <span className={cn("mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", color.badge)}>
                            {level.level}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink">{title}</p>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </CardBody>
      ) : null}
    </Card>
  );
}
