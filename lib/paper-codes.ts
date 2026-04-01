const TRACK_CODE_MAP: Record<string, string> = {
  math: "MATH",
  biol: "BIOL",
  phys: "PHYS",
  chem: "CHEM",
  comp: "COMP",
};

export function getTrackPaperCode(trackName: string | null | undefined) {
  if (!trackName) return "TEST";

  const normalized = trackName.trim().toLowerCase();
  return TRACK_CODE_MAP[normalized] || "TEST";
}

export function formatPaperCode(prefix: string, sequence: number) {
  return `${prefix}-${sequence.toString().padStart(2, "0")}`;
}

export function parsePaperCodeSequence(code: string | null | undefined, prefix: string) {
  if (!code) return null;
  const match = code.match(new RegExp(`^${prefix}-(\\d+)$`));
  if (!match) return null;
  return Number(match[1]);
}
