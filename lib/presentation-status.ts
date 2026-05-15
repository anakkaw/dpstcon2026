export const PUBLISHED_PRESENTATION_STATUSES = ["SCHEDULED", "COMPLETED"] as const;
export const PUBLISHED_POSTER_SLOT_STATUSES = ["CONFIRMED", "COMPLETED"] as const;

export type PublishedPresentationStatus = (typeof PUBLISHED_PRESENTATION_STATUSES)[number];
export type PublishedPosterSlotStatus = (typeof PUBLISHED_POSTER_SLOT_STATUSES)[number];

export function isPublishedPresentationStatus(
  status: string | null | undefined
): status is PublishedPresentationStatus {
  return status === "SCHEDULED" || status === "COMPLETED";
}

export function isPublishedPosterSlotStatus(
  status: string | null | undefined
): status is PublishedPosterSlotStatus {
  return status === "CONFIRMED" || status === "COMPLETED";
}
