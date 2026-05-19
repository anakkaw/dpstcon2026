export type PosterOrderMoveDirection = "up" | "down";

export function posterOrderSettingsKey(trackId: string): string {
  return `posterOrder:${trackId}`;
}

export function parsePosterOrderValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function normalizePosterOrder(input: {
  currentIds: string[];
  savedIds: string[];
}): string[] {
  const currentSet = new Set(input.currentIds);
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const id of input.savedIds) {
    if (!currentSet.has(id) || seen.has(id)) continue;
    ordered.push(id);
    seen.add(id);
  }

  for (const id of input.currentIds) {
    if (seen.has(id)) continue;
    ordered.push(id);
    seen.add(id);
  }

  return ordered;
}

export function movePosterOrderItem(input: {
  currentIds: string[];
  savedIds: string[];
  submissionId: string;
  direction: PosterOrderMoveDirection;
}): string[] {
  const order = normalizePosterOrder({
    currentIds: input.currentIds,
    savedIds: input.savedIds,
  });
  const index = order.indexOf(input.submissionId);
  if (index === -1) return order;

  const targetIndex = input.direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= order.length) return order;

  const next = order.slice();
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}
