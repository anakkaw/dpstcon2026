/**
 * Shared utilities for composing display names from structured fields.
 * Used across both server and client code.
 */

export interface NameFields {
  name: string;
  prefixTh?: string | null;
  firstNameTh?: string | null;
  lastNameTh?: string | null;
  prefixEn?: string | null;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
}

/** Compose Thai display name from structured fields, fallback to `name` */
export function displayNameTh(u: NameFields): string {
  const f = u.firstNameTh || "";
  const l = u.lastNameTh || "";
  if (!f && !l) return u.name;
  const p = u.prefixTh || "";
  return `${p}${f} ${l}`.trim();
}

/** Compose English display name from structured fields */
export function displayNameEn(u: Pick<NameFields, "prefixEn" | "firstNameEn" | "lastNameEn">): string {
  return [u.prefixEn, u.firstNameEn, u.lastNameEn].filter(Boolean).join(" ");
}

/** Get the first character for avatar initial */
export function nameInitial(u: NameFields): string {
  if (u.firstNameEn) return u.firstNameEn[0].toUpperCase();
  if (u.firstNameTh) return u.firstNameTh[0];
  return u.name?.[0]?.toUpperCase() || "U";
}

/** The structured name columns to include in Drizzle select */
export const NAME_COLUMNS = {
  name: true,
  prefixTh: true,
  firstNameTh: true,
  lastNameTh: true,
  prefixEn: true,
  firstNameEn: true,
  lastNameEn: true,
} as const;
