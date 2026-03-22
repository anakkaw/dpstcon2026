export const APP_NAME = "DPSTCon";
export const APP_DESCRIPTION = "ระบบบริหารการพิจารณาบทความสำหรับการประชุมวิชาการ";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const NAV_ITEMS = {
  ADMIN: [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/submissions", label: "Papers", icon: "FileText" },
    { href: "/reviews", label: "Reviews", icon: "ClipboardCheck" },
    { href: "/presentations/oral", label: "Oral Presentation", icon: "Mic" },
    { href: "/presentations/poster", label: "Poster Presentation", icon: "Image" },
    { href: "/deadlines", label: "Schedule & Docs", icon: "Calendar" },
    { href: "/admin/users", label: "User Management", icon: "Users" },
  ],
  PROGRAM_CHAIR: [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/submissions", label: "Papers", icon: "FileText" },
    { href: "/reviews", label: "Reviews", icon: "ClipboardCheck" },
    { href: "/track-team", label: "Track Team", icon: "Users" },
    { href: "/presentations/oral", label: "Oral Presentation", icon: "Mic" },
    { href: "/presentations/poster", label: "Poster Presentation", icon: "Image" },
    { href: "/deadlines", label: "Schedule & Docs", icon: "Calendar" },
  ],
  REVIEWER: [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/reviews", label: "My Reviews", icon: "ClipboardCheck" },
    { href: "/deadlines", label: "Schedule & Docs", icon: "Calendar" },
  ],
  COMMITTEE: [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/presentations/oral", label: "Oral Presentation", icon: "Mic" },
    { href: "/presentations/poster", label: "Poster Presentation", icon: "Image" },
    { href: "/deadlines", label: "Schedule & Docs", icon: "Calendar" },
  ],
  AUTHOR: [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/submissions", label: "My Papers", icon: "FileText" },
    { href: "/deadlines", label: "Schedule & Docs", icon: "Calendar" },
  ],
} as const;

/** Merge navigation items for multiple roles, deduplicate by href */
export function getNavItemsForRoles(
  roles: string[]
): (typeof NAV_ITEMS)[keyof typeof NAV_ITEMS][number][] {
  const seen = new Set<string>();
  const merged: (typeof NAV_ITEMS)[keyof typeof NAV_ITEMS][number][] = [];

  // Sort roles by priority so higher-priority role items appear first
  const ROLE_ORDER = ["ADMIN", "PROGRAM_CHAIR", "COMMITTEE", "REVIEWER", "AUTHOR"];
  const sortedRoles = [...roles].sort(
    (a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b)
  );

  for (const role of sortedRoles) {
    const items = NAV_ITEMS[role as keyof typeof NAV_ITEMS];
    if (!items) continue;
    for (const item of items) {
      if (!seen.has(item.href)) {
        seen.add(item.href);
        merged.push(item);
      }
    }
  }

  return merged.length > 0 ? merged : [...NAV_ITEMS.AUTHOR];
}
