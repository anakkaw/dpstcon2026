export const APP_NAME = "DPSTCon";
export const APP_DESCRIPTION = "ระบบบริหารการส่งและพิจารณาบทความ";
export const APP_VERSION = "1.0.1";

export const CONFERENCE_TITLE_TH =
  "การประชุมวิชาการวิทยาศาสตร์และเทคโนโลยี นักเรียนทุน พสวท. ประจำปี 2569";
export const CONFERENCE_HOST_TH = "คณะวิทยาศาสตร์ มหาวิทยาลัยนเรศวร";
export const CONFERENCE_COMMITTEE_TH = "คณะกรรมการฝ่ายวิชาการ";
export const EMAIL_SYSTEM_SIGNATURE = "DPSTCon Conference Management System";

export const ADMIN_CONTACT_NAME_TH = "ผศ.ดร.วัชรพงษ์ อนรรฆเมธี";
export const ADMIN_CONTACT_EMAIL =
  process.env.ADMIN_CONTACT_EMAIL || "watcharaponga@nu.ac.th";
export const EMAIL_FROM =
  process.env.EMAIL_FROM || "DPSTCon Academic <academic@acadscinu.org>";
export const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || ADMIN_CONTACT_EMAIL;

/** Number of days an advisor approval token remains valid after submission */
export const ADVISOR_TOKEN_EXPIRY_DAYS = 14;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const NAV_ITEMS = {
  ADMIN: [
    { href: "/dashboard", label: "nav.dashboard", icon: "LayoutDashboard" },
    { href: "/submissions", label: "nav.workbench", icon: "FileText" },
    { href: "/presentations", label: "nav.presentations", icon: "Presentation" },
    { href: "/deadlines", label: "nav.scheduleAndDocs", icon: "Calendar" },
    { href: "/admin/authors", label: "nav.authorStatus", icon: "BarChart2" },
    { href: "/admin/users", label: "nav.userManagement", icon: "Users" },
    { href: "/admin/tracks", label: "nav.trackManagement", icon: "Layers" },
  ],
  PROGRAM_CHAIR: [
    { href: "/dashboard", label: "nav.dashboard", icon: "LayoutDashboard" },
    { href: "/submissions", label: "nav.workbench", icon: "FileText" },
    { href: "/track-team", label: "nav.trackTeam", icon: "Users" },
    { href: "/presentations", label: "nav.presentations", icon: "Presentation" },
    { href: "/deadlines", label: "nav.scheduleAndDocs", icon: "Calendar" },
  ],
  REVIEWER: [
    { href: "/dashboard", label: "nav.dashboard", icon: "LayoutDashboard" },
    { href: "/reviews", label: "nav.myReviews", icon: "ClipboardCheck" },
    { href: "/deadlines", label: "nav.scheduleAndDocs", icon: "Calendar" },
  ],
  COMMITTEE: [
    { href: "/dashboard", label: "nav.dashboard", icon: "LayoutDashboard" },
    { href: "/presentations/scoring", label: "nav.scoring", icon: "Star" },
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

export type NavItemType = (typeof NAV_ITEMS)[keyof typeof NAV_ITEMS][number];

export interface NavGroup {
  role: string;
  items: NavItemType[];
}

/** Group navigation items by role, with shared items (dashboard, schedule) shown once at top */
export function getNavItemsGroupedByRole(roles: string[]): NavGroup[] {
  const ROLE_ORDER = ["ADMIN", "PROGRAM_CHAIR", "COMMITTEE", "REVIEWER", "AUTHOR"];
  const sortedRoles = [...roles]
    .filter((r) => NAV_ITEMS[r as keyof typeof NAV_ITEMS])
    .sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));

  if (sortedRoles.length === 0) sortedRoles.push("AUTHOR");

  // Single role — no grouping needed
  if (sortedRoles.length === 1) {
    return [{ role: sortedRoles[0], items: [...NAV_ITEMS[sortedRoles[0] as keyof typeof NAV_ITEMS]] }];
  }

  // Shared hrefs that appear in every role the user has
  const roleSets = sortedRoles.map(
    (r) => new Set(NAV_ITEMS[r as keyof typeof NAV_ITEMS].map((i) => i.href))
  );
  const sharedHrefs = new Set(
    [...roleSets[0]].filter((href) => roleSets.every((s) => s.has(href)))
  );

  const groups: NavGroup[] = [];

  // Common group (items shared across all roles)
  const commonItems = NAV_ITEMS[sortedRoles[0] as keyof typeof NAV_ITEMS].filter(
    (item) => sharedHrefs.has(item.href)
  );
  if (commonItems.length > 0) {
    groups.push({ role: "_COMMON", items: commonItems });
  }

  // Per-role groups (only unique items)
  for (const role of sortedRoles) {
    const items = NAV_ITEMS[role as keyof typeof NAV_ITEMS].filter(
      (item) => !sharedHrefs.has(item.href)
    );
    if (items.length > 0) {
      groups.push({ role, items });
    }
  }

  return groups;
}
