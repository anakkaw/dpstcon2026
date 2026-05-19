export type PosterPlannerSubgroup = {
  id: string;
  name: string;
  submissionIds: string[];
  judgeIds: string[];
};

export function posterSubgroupsSettingsKey(trackId: string) {
  return `posterSubgroups:${trackId}`;
}

function uniqueStrings(values: unknown) {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

export function parsePosterSubgroupsValue(value: unknown): PosterPlannerSubgroup[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id.trim() : "";
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!id || !name) return null;

      return {
        id,
        name,
        submissionIds: uniqueStrings(record.submissionIds),
        judgeIds: uniqueStrings(record.judgeIds),
      };
    })
    .filter((item): item is PosterPlannerSubgroup => item !== null);
}

export function normalizePosterSubgroups(input: {
  currentSubmissionIds: string[];
  candidateJudgeIds: string[];
  savedSubgroups: PosterPlannerSubgroup[];
}): PosterPlannerSubgroup[] {
  const currentSubmissionIds = new Set(input.currentSubmissionIds);
  const candidateJudgeIds = new Set(input.candidateJudgeIds);
  const usedSubgroupIds = new Set<string>();
  const usedSubmissionIds = new Set<string>();
  const normalized: PosterPlannerSubgroup[] = [];

  for (const subgroup of input.savedSubgroups) {
    const id = subgroup.id.trim();
    const name = subgroup.name.trim();
    if (!id || !name || usedSubgroupIds.has(id)) continue;

    const submissionIds: string[] = [];
    for (const submissionId of subgroup.submissionIds) {
      if (!currentSubmissionIds.has(submissionId)) continue;
      if (usedSubmissionIds.has(submissionId)) continue;
      usedSubmissionIds.add(submissionId);
      submissionIds.push(submissionId);
    }

    const seenJudgeIds = new Set<string>();
    const judgeIds = subgroup.judgeIds.filter((judgeId) => {
      if (!candidateJudgeIds.has(judgeId) || seenJudgeIds.has(judgeId)) return false;
      seenJudgeIds.add(judgeId);
      return true;
    });

    usedSubgroupIds.add(id);
    normalized.push({ id, name, submissionIds, judgeIds });
  }

  return normalized;
}
