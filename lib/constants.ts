export const APP_NAME = "DPSTCon";
export const APP_DESCRIPTION = "ระบบบริหารการพิจารณาบทความสำหรับการประชุมวิชาการ";
export const APP_VERSION = "1.0.1";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const NAV_ITEMS = {
  ADMIN: [
    { href: "/dashboard", label: "nav.dashboard", icon: "LayoutDashboard" },
    { href: "/submissions", label: "nav.papers", icon: "FileText" },
    { href: "/reviews", label: "nav.reviews", icon: "ClipboardCheck" },
    { href: "/presentations/oral", label: "nav.oralPresentation", icon: "Mic" },
    { href: "/presentations/poster", label: "nav.posterPresentation", icon: "Image" },
    { href: "/deadlines", label: "nav.scheduleAndDocs", icon: "Calendar" },
    { href: "/admin/users", label: "nav.userManagement", icon: "Users" },
  ],
  PROGRAM_CHAIR: [
    { href: "/dashboard", label: "nav.dashboard", icon: "LayoutDashboard" },
    { href: "/submissions", label: "nav.papers", icon: "FileText" },
    { href: "/reviews", label: "nav.reviews", icon: "ClipboardCheck" },
    { href: "/track-team", label: "nav.trackTeam", icon: "Users" },
    { href: "/presentations/oral", label: "nav.oralPresentation", icon: "Mic" },
    { href: "/presentations/poster", label: "nav.posterPresentation", icon: "Image" },
    { href: "/deadlines", label: "nav.scheduleAndDocs", icon: "Calendar" },
  ],
  REVIEWER: [
    { href: "/dashboard", label: "nav.dashboard", icon: "LayoutDashboard" },
    { href: "/reviews", label: "nav.myReviews", icon: "ClipboardCheck" },
    { href: "/deadlines", label: "nav.scheduleAndDocs", icon: "Calendar" },
  ],
  COMMITTEE: [
    { href: "/dashboard", label: "nav.dashboard", icon: "LayoutDashboard" },
    { href: "/presentations/oral", label: "nav.oralPresentation", icon: "Mic" },
    { href: "/presentations/poster", label: "nav.posterPresentation", icon: "Image" },
    { href: "/deadlines", label: "nav.scheduleAndDocs", icon: "Calendar" },
  ],
  AUTHOR: [
    { href: "/dashboard", label: "nav.dashboard", icon: "LayoutDashboard" },
    { href: "/submissions", label: "nav.myPapers", icon: "FileText" },
    { href: "/deadlines", label: "nav.scheduleAndDocs", icon: "Calendar" },
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
