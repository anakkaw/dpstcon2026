export type PosterScheduleSlotInput = {
  id?: string;
  startsAt: string | Date;
  endsAt: string | Date;
};

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

export function sortPosterScheduleSlots<T extends PosterScheduleSlotInput>(slots: T[]): T[] {
  return slots
    .slice()
    .sort(
      (a, b) =>
        toDate(a.startsAt).getTime() - toDate(b.startsAt).getTime() ||
        toDate(a.endsAt).getTime() - toDate(b.endsAt).getTime() ||
        (a.id ?? "").localeCompare(b.id ?? "")
    );
}

export function getPosterScheduleSlotMinutes(slot: PosterScheduleSlotInput): number {
  return Math.max(
    1,
    Math.round((toDate(slot.endsAt).getTime() - toDate(slot.startsAt).getTime()) / 60000)
  );
}

export function getPosterScheduleSortAt(
  slots: PosterScheduleSlotInput[],
  fallback: string | Date | null = null
): Date | null {
  const firstSlot = sortPosterScheduleSlots(slots)[0];
  if (firstSlot) return toDate(firstSlot.startsAt);
  return fallback ? toDate(fallback) : null;
}

export function formatThaiPosterSlotSummary(
  slots: PosterScheduleSlotInput[],
  room: string | null
): string {
  const sortedSlots = sortPosterScheduleSlots(slots);
  if (sortedSlots.length === 0) return room ? `รอระบุเวลา ห้อง ${room}` : "รอระบุเวลา";

  const formatter = new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
  const roomText = room ? ` ห้อง ${room}` : "";
  return sortedSlots
    .map((slot, index) => `Slot ${index + 1}: ${formatter.format(toDate(slot.startsAt))}${roomText}`)
    .join(", ");
}
