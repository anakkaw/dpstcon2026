export const POSTER_REQUIRED_JUDGE_COUNT = 3;

export type PosterSlotBoundary = {
  id?: string;
  startsAt: string | Date;
  endsAt: string | Date;
};

export type PosterJudgeSlot = PosterSlotBoundary & {
  id: string;
  judgeId: string;
};

export type PosterJudgeAssignment = {
  slotId: string;
  judgeId: string;
  startsAt: string;
  endsAt: string;
  slotTemplateId: string;
};

export type PosterBusySlot = PosterSlotBoundary & {
  slotId: string;
  judgeId: string;
  submissionId: string | null;
  label: string | null;
};

function toSlotBoundary(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function createPosterSlotTemplateId(startsAt: string | Date, endsAt: string | Date): string {
  return `${toSlotBoundary(startsAt)}__${toSlotBoundary(endsAt)}`;
}

export function posterSlotRangesOverlap(
  aStartsAt: string | Date,
  aEndsAt: string | Date,
  bStartsAt: string | Date,
  bEndsAt: string | Date
): boolean {
  return new Date(aStartsAt).getTime() < new Date(bEndsAt).getTime() &&
    new Date(aEndsAt).getTime() > new Date(bStartsAt).getTime();
}

export function buildPosterJudgeAssignments(slots: PosterJudgeSlot[]): PosterJudgeAssignment[] {
  return slots
    .map((slot) => {
      const startsAt = toSlotBoundary(slot.startsAt);
      const endsAt = toSlotBoundary(slot.endsAt);
      return {
        slotId: slot.id,
        judgeId: slot.judgeId,
        startsAt,
        endsAt,
        slotTemplateId: createPosterSlotTemplateId(startsAt, endsAt),
      };
    })
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
        new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime() ||
        a.judgeId.localeCompare(b.judgeId)
    );
}

export function getPosterScheduleReadiness(assignments: PosterJudgeAssignment[]) {
  const slotIds = new Set(assignments.map((assignment) => assignment.slotTemplateId));
  const uniqueJudgeIds = new Set(assignments.map((assignment) => assignment.judgeId));
  const hasDistinctSlots =
    assignments.length === POSTER_REQUIRED_JUDGE_COUNT &&
    slotIds.size === POSTER_REQUIRED_JUDGE_COUNT;
  const hasExactJudgeCount =
    assignments.length === POSTER_REQUIRED_JUDGE_COUNT &&
    uniqueJudgeIds.size === POSTER_REQUIRED_JUDGE_COUNT;

  return {
    isReady: hasDistinctSlots && hasExactJudgeCount,
    hasDistinctSlots,
    slotTemplateIds: Array.from(slotIds),
    assignmentCount: assignments.length,
    uniqueJudgeCount: uniqueJudgeIds.size,
    missingJudgeCount: Math.max(0, POSTER_REQUIRED_JUDGE_COUNT - uniqueJudgeIds.size),
    extraJudgeCount: Math.max(0, assignments.length - POSTER_REQUIRED_JUDGE_COUNT),
    duplicateJudgeCount: Math.max(0, assignments.length - uniqueJudgeIds.size),
    duplicateSlotCount: Math.max(0, assignments.length - slotIds.size),
  };
}

export function getUnavailableJudgeIdsForSlot(input: {
  slot: PosterSlotBoundary;
  currentSubmissionId: string;
  busySlots: PosterBusySlot[];
}): Set<string> {
  const unavailable = new Set<string>();

  for (const busySlot of input.busySlots) {
    if (busySlot.submissionId === input.currentSubmissionId) continue;
    if (
      posterSlotRangesOverlap(
        input.slot.startsAt,
        input.slot.endsAt,
        busySlot.startsAt,
        busySlot.endsAt
      )
    ) {
      unavailable.add(busySlot.judgeId);
    }
  }

  return unavailable;
}
