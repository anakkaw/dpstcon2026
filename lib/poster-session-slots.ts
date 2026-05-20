export type PosterSessionSlotRange = {
  id?: string;
  startsAt: string;
  endsAt: string;
};

export type PosterSlotAssignmentRange = {
  id: string;
  startsAt: string | Date;
  endsAt: string | Date;
};

function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function slotRangeKey(slot: { startsAt: string | Date; endsAt: string | Date }) {
  return `${toIso(slot.startsAt)}__${toIso(slot.endsAt)}`;
}

export function getRemovedPosterSessionSlotTemplates(input: {
  before: PosterSessionSlotRange[];
  after: PosterSessionSlotRange[];
}) {
  const afterKeys = new Set(input.after.map(slotRangeKey));
  return input.before.filter((slot) => !afterKeys.has(slotRangeKey(slot)));
}

export function getOrphanPosterSlotAssignmentIds(input: {
  activeTemplates: PosterSessionSlotRange[];
  assignments: PosterSlotAssignmentRange[];
}) {
  const activeTemplateKeys = new Set(input.activeTemplates.map(slotRangeKey));
  return input.assignments
    .filter((assignment) => !activeTemplateKeys.has(slotRangeKey(assignment)))
    .map((assignment) => assignment.id);
}
