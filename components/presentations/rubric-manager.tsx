"use client";

import { useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
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

interface RubricManagerProps {
  criteria: CriterionData[];
  canEdit?: boolean;
  onSave?: (criteria: CriterionData[]) => Promise<void>;
  /** When true, users can collapse the criteria body (header stays visible). */
  collapsible?: boolean;
  /** Initial expanded state when `collapsible` is true. */
  defaultExpanded?: boolean;
}

export function RubricManager({
  criteria,
  canEdit = false,
  onSave,
  collapsible = true,
  defaultExpanded = true,
}: RubricManagerProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<CriterionData[]>(criteria);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();

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
                      min={0}
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
                    {criterion.levels.map((level, levelIndex) => (
                      <div
                        key={`${criterion.id}-${level.level}`}
                        className="rounded-xl border border-border/50 bg-white p-3"
                      >
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Badge tone="info">
                            {t("presentations.levelLabel", { n: level.level })}
                          </Badge>
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
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div>
                        <p className="text-lg font-semibold text-ink">{criterion.nameTh}</p>
                        <p className="text-sm text-ink-muted">{criterion.nameEn}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-ink">{criterion.descriptionTh}</p>
                        <p className="text-sm text-ink-muted">{criterion.descriptionEn}</p>
                      </div>
                    </div>
                    <Badge tone="info">
                      {t("presentations.totalPointsValue", {
                        n: criterion.totalPoints,
                      })}
                    </Badge>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-5">
                    {criterion.levels.map((level) => (
                      <div
                        key={`${criterion.id}-${level.level}`}
                        className="rounded-xl border border-border/50 bg-white p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Badge tone="info">
                            {t("presentations.levelLabel", { n: level.level })}
                          </Badge>
                        </div>
                        <p className="text-sm font-semibold text-ink">{level.titleTh}</p>
                        <p className="text-xs text-ink-muted">{level.titleEn}</p>
                        <div className="mt-3 space-y-2">
                          <p className="text-xs leading-relaxed text-ink">
                            {level.descriptionTh}
                          </p>
                          <p className="text-xs leading-relaxed text-ink-muted">
                            {level.descriptionEn}
                          </p>
                        </div>
                      </div>
                    ))}
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
