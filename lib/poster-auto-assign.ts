import { posterSlotRangesOverlap } from "@/lib/poster-planner-rules";

export type PosterAutoAssignPoster = {
  submissionId: string;
};

export type PosterAutoAssignJudge = {
  judgeId: string;
  name?: string | null;
};

export type PosterAutoAssignSlot = {
  id: string;
  startsAt: string | Date;
  endsAt: string | Date;
};

export type PosterAutoAssignBusySlot = {
  judgeId: string;
  startsAt: string | Date;
  endsAt: string | Date;
};

export type PosterAutoAssignment = {
  submissionId: string;
  judgeId: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
};

export type PosterAutoAssignPlan =
  | {
      ok: true;
      judgeCount: number;
      assignments: PosterAutoAssignment[];
      reason?: never;
    }
  | {
      ok: false;
      judgeCount: number;
      assignments: PosterAutoAssignment[];
      reason:
        | "NO_POSTERS"
        | "INSUFFICIENT_SLOTS"
        | "INSUFFICIENT_JUDGES"
        | "INSUFFICIENT_JUDGE_CAPACITY";
    };

const REQUIRED_REVIEWS_PER_POSTER = 3;
const MAX_EXACT_JUDGE_SET_ATTEMPTS = 5000;
const MAX_TRIPLES_PER_POSTER = 160;
const MAX_SEARCH_NODES = 60000;

function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function sortSlots<T extends PosterAutoAssignSlot>(slots: T[]) {
  return slots
    .slice()
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
        new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime() ||
        a.id.localeCompare(b.id)
    );
}

export function getMinimumPosterJudgeCount(input: {
  posterCount: number;
  slotCount: number;
}) {
  if (input.posterCount <= 0) return 0;
  if (input.slotCount <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(
    REQUIRED_REVIEWS_PER_POSTER,
    Math.ceil((input.posterCount * REQUIRED_REVIEWS_PER_POSTER) / input.slotCount)
  );
}

function judgeCanUseSlot(input: {
  judgeId: string;
  slot: PosterAutoAssignSlot;
  busySlots: PosterAutoAssignBusySlot[];
}) {
  return !input.busySlots.some(
    (busySlot) =>
      busySlot.judgeId === input.judgeId &&
      posterSlotRangesOverlap(
        input.slot.startsAt,
        input.slot.endsAt,
        busySlot.startsAt,
        busySlot.endsAt
      )
  );
}

function sortJudgesByAvailability(input: {
  judges: PosterAutoAssignJudge[];
  slots: PosterAutoAssignSlot[];
  busySlots: PosterAutoAssignBusySlot[];
}) {
  return input.judges
    .map((judge, index) => ({
      ...judge,
      inputIndex: index,
      availableSlotCount: input.slots.filter((slot) =>
        judgeCanUseSlot({ judgeId: judge.judgeId, slot, busySlots: input.busySlots })
      ).length,
    }))
    .sort(
      (a, b) =>
        b.availableSlotCount - a.availableSlotCount ||
        (a.name ?? a.judgeId).localeCompare(b.name ?? b.judgeId) ||
        a.inputIndex - b.inputIndex
    );
}

function attemptPlan(input: {
  posters: PosterAutoAssignPoster[];
  judges: PosterAutoAssignJudge[];
  slots: PosterAutoAssignSlot[];
  busySlots: PosterAutoAssignBusySlot[];
  maxJudgeCount: number;
}): PosterAutoAssignment[] | null {
  const sortedSlots = sortSlots(input.slots);
  const selectedJudges = sortJudgesByAvailability({
    judges: input.judges,
    slots: sortedSlots,
    busySlots: input.busySlots,
  }).slice(0, input.maxJudgeCount);
  const usedJudgeSlotPairs = new Set<string>();
  const judgeLoad = new Map(selectedJudges.map((judge) => [judge.judgeId, 0]));
  const slotLoad = new Map(sortedSlots.map((slot) => [slot.id, 0]));
  const assignments: PosterAutoAssignment[] = [];
  let searchNodes = 0;

  function buildCandidateTriples() {
    const candidates: Array<{
      judge: PosterAutoAssignJudge;
      slot: PosterAutoAssignSlot;
      score: number;
    }> = [];

    for (const judge of selectedJudges) {
      for (const slot of sortedSlots) {
        const pairKey = `${judge.judgeId}:${slot.id}`;
        if (usedJudgeSlotPairs.has(pairKey)) continue;
        if (!judgeCanUseSlot({ judgeId: judge.judgeId, slot, busySlots: input.busySlots })) {
          continue;
        }
        candidates.push({
          judge,
          slot,
          score:
            (judgeLoad.get(judge.judgeId) ?? 0) * 10 +
            (slotLoad.get(slot.id) ?? 0),
        });
      }
    }

    candidates.sort(
      (a, b) =>
        a.score - b.score ||
        (a.judge.name ?? a.judge.judgeId).localeCompare(b.judge.name ?? b.judge.judgeId) ||
        new Date(a.slot.startsAt).getTime() - new Date(b.slot.startsAt).getTime()
    );

    const triples: Array<{ items: typeof candidates; score: number }> = [];
    for (let first = 0; first < candidates.length; first += 1) {
      for (let second = first + 1; second < candidates.length; second += 1) {
        if (candidates[first].judge.judgeId === candidates[second].judge.judgeId) continue;
        if (candidates[first].slot.id === candidates[second].slot.id) continue;

        for (let third = second + 1; third < candidates.length; third += 1) {
          const items = [candidates[first], candidates[second], candidates[third]];
          if (new Set(items.map((item) => item.judge.judgeId)).size !== REQUIRED_REVIEWS_PER_POSTER) {
            continue;
          }
          if (new Set(items.map((item) => item.slot.id)).size !== REQUIRED_REVIEWS_PER_POSTER) {
            continue;
          }

          triples.push({
            items,
            score: items.reduce((sum, item) => sum + item.score, 0),
          });
        }
      }
    }

    return triples
      .sort((a, b) => a.score - b.score)
      .slice(0, MAX_TRIPLES_PER_POSTER)
      .map((triple) => triple.items);
  }

  function applyTriple(
    poster: PosterAutoAssignPoster,
    triple: ReturnType<typeof buildCandidateTriples>[number]
  ) {
    const applied: PosterAutoAssignment[] = [];

    for (const item of triple) {
      const pairKey = `${item.judge.judgeId}:${item.slot.id}`;
      usedJudgeSlotPairs.add(pairKey);
      judgeLoad.set(item.judge.judgeId, (judgeLoad.get(item.judge.judgeId) ?? 0) + 1);
      slotLoad.set(item.slot.id, (slotLoad.get(item.slot.id) ?? 0) + 1);
      assignments.push({
        submissionId: poster.submissionId,
        judgeId: item.judge.judgeId,
        slotId: item.slot.id,
        startsAt: toIso(item.slot.startsAt),
        endsAt: toIso(item.slot.endsAt),
      });
      applied.push(assignments[assignments.length - 1]);
    }

    return applied;
  }

  function rollbackTriple(applied: PosterAutoAssignment[]) {
    for (const assignment of applied) {
      usedJudgeSlotPairs.delete(`${assignment.judgeId}:${assignment.slotId}`);
      judgeLoad.set(assignment.judgeId, Math.max(0, (judgeLoad.get(assignment.judgeId) ?? 0) - 1));
      slotLoad.set(assignment.slotId, Math.max(0, (slotLoad.get(assignment.slotId) ?? 0) - 1));
      assignments.pop();
    }
  }

  function search(posterIndex: number): boolean {
    searchNodes += 1;
    if (searchNodes > MAX_SEARCH_NODES) return false;
    if (posterIndex >= input.posters.length) return true;

    const poster = input.posters[posterIndex];
    const triples = buildCandidateTriples();
    for (const triple of triples) {
      const applied = applyTriple(poster, triple);
      if (search(posterIndex + 1)) return true;
      rollbackTriple(applied);
    }

    return false;
  }

  return search(0) ? assignments : null;
}

function countCombinations(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  const effectiveK = Math.min(k, n - k);
  let value = 1;
  for (let index = 1; index <= effectiveK; index += 1) {
    value = (value * (n - effectiveK + index)) / index;
    if (value > MAX_EXACT_JUDGE_SET_ATTEMPTS) return value;
  }
  return value;
}

function buildCombinations<T>(items: T[], size: number, limit: number): T[][] {
  const results: T[][] = [];

  function visit(start: number, chosen: T[]) {
    if (results.length >= limit) return;
    if (chosen.length === size) {
      results.push(chosen.slice());
      return;
    }

    const needed = size - chosen.length;
    for (let index = start; index <= items.length - needed; index += 1) {
      chosen.push(items[index]);
      visit(index + 1, chosen);
      chosen.pop();
    }
  }

  visit(0, []);
  return results;
}

function uniqueJudgeSets<T extends PosterAutoAssignJudge>(sets: T[][]) {
  const seen = new Set<string>();
  return sets.filter((set) => {
    const key = set.map((judge) => judge.judgeId).sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getJudgeSetsForCount<T extends PosterAutoAssignJudge>(
  rankedJudges: T[],
  judgeCount: number
) {
  if (countCombinations(rankedJudges.length, judgeCount) <= MAX_EXACT_JUDGE_SET_ATTEMPTS) {
    return buildCombinations(rankedJudges, judgeCount, MAX_EXACT_JUDGE_SET_ATTEMPTS);
  }

  const top = rankedJudges.slice(0, judgeCount);
  const reserve = rankedJudges.slice(judgeCount, Math.min(rankedJudges.length, judgeCount + 12));
  const sets: T[][] = [top];

  for (let replaceIndex = judgeCount - 1; replaceIndex >= 0; replaceIndex -= 1) {
    for (const reserveJudge of reserve) {
      sets.push([
        ...top.slice(0, replaceIndex),
        reserveJudge,
        ...top.slice(replaceIndex + 1),
      ]);
    }
  }

  return uniqueJudgeSets(sets).slice(0, MAX_EXACT_JUDGE_SET_ATTEMPTS);
}

export function createMinimalPosterJudgePlan(input: {
  posters: PosterAutoAssignPoster[];
  judges: PosterAutoAssignJudge[];
  slots: PosterAutoAssignSlot[];
  busySlots: PosterAutoAssignBusySlot[];
}): PosterAutoAssignPlan {
  if (input.posters.length === 0) {
    return { ok: false, judgeCount: 0, assignments: [], reason: "NO_POSTERS" };
  }
  if (input.slots.length < REQUIRED_REVIEWS_PER_POSTER) {
    return { ok: false, judgeCount: 0, assignments: [], reason: "INSUFFICIENT_SLOTS" };
  }
  if (input.judges.length < REQUIRED_REVIEWS_PER_POSTER) {
    return { ok: false, judgeCount: input.judges.length, assignments: [], reason: "INSUFFICIENT_JUDGES" };
  }

  const sortedSlots = sortSlots(input.slots);
  const rankedJudges = sortJudgesByAvailability({
    judges: input.judges,
    slots: sortedSlots,
    busySlots: input.busySlots,
  });
  const lowerBound = getMinimumPosterJudgeCount({
    posterCount: input.posters.length,
    slotCount: sortedSlots.length,
  });

  for (let judgeCount = lowerBound; judgeCount <= input.judges.length; judgeCount += 1) {
    const judgeSets = getJudgeSetsForCount(rankedJudges, judgeCount);
    for (const judgeSet of judgeSets) {
      const assignments = attemptPlan({
        posters: input.posters,
        judges: judgeSet,
        slots: sortedSlots,
        busySlots: input.busySlots,
        maxJudgeCount: judgeSet.length,
      });

      if (assignments) {
        return { ok: true, judgeCount, assignments };
      }
    }
  }

  return {
    ok: false,
    judgeCount: input.judges.length,
    assignments: [],
    reason: "INSUFFICIENT_JUDGE_CAPACITY",
  };
}
