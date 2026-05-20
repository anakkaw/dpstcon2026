export type PosterSessionSlotRange = {
  id?: string;
  startsAt: string;
  endsAt: string;
};

function slotRangeKey(slot: PosterSessionSlotRange) {
  return `${slot.startsAt}__${slot.endsAt}`;
}

export function getRemovedPosterSessionSlotTemplates(input: {
  before: PosterSessionSlotRange[];
  after: PosterSessionSlotRange[];
}) {
  const afterKeys = new Set(input.after.map(slotRangeKey));
  return input.before.filter((slot) => !afterKeys.has(slotRangeKey(slot)));
}
