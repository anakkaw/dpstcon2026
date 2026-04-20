import { db } from "@/server/db";
import { user, userRoles, submissions } from "@/server/db/schema";
import { eq, inArray } from "drizzle-orm";

export interface AuthorSubmissionSummary {
  id: string;
  paperCode: string | null;
  title: string;
  status: string;
  trackName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthorStatusRow {
  id: string;
  name: string;
  email: string;
  prefixTh: string | null;
  firstNameTh: string | null;
  lastNameTh: string | null;
  prefixEn: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  affiliation: string | null;
  submissions: AuthorSubmissionSummary[];
}

export interface AuthorStatusStats {
  totalAuthors: number;
  noSubmission: number;
  draftOnly: number;
  pendingAdvisor: number;
  submitted: number;
  accepted: number;
  rejected: number;
}

export async function getAdminAuthorStatusData(): Promise<{
  authors: AuthorStatusRow[];
  stats: AuthorStatusStats;
}> {
  // Get all users with AUTHOR role
  const authorRoleRows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.role, "AUTHOR"));

  const authorIds = [...new Set(authorRoleRows.map((r) => r.userId))];

  if (authorIds.length === 0) {
    return {
      authors: [],
      stats: { totalAuthors: 0, noSubmission: 0, draftOnly: 0, pendingAdvisor: 0, submitted: 0, accepted: 0, rejected: 0 },
    };
  }

  const [authorUsers, allSubmissions] = await Promise.all([
    db.query.user.findMany({
      where: inArray(user.id, authorIds),
      columns: {
        id: true, name: true, email: true, affiliation: true,
        prefixTh: true, firstNameTh: true, lastNameTh: true,
        prefixEn: true, firstNameEn: true, lastNameEn: true,
      },
      with: {},
    }),
    db.query.submissions.findMany({
      where: inArray(submissions.authorId, authorIds),
      columns: {
        id: true, authorId: true, paperCode: true, title: true,
        status: true, createdAt: true, updatedAt: true,
      },
      with: {
        track: { columns: { name: true } },
      },
    }),
  ]);

  // Group submissions by authorId
  const subsByAuthor = new Map<string, AuthorSubmissionSummary[]>();
  for (const sub of allSubmissions) {
    const list = subsByAuthor.get(sub.authorId) ?? [];
    list.push({
      id: sub.id,
      paperCode: sub.paperCode,
      title: sub.title,
      status: sub.status,
      trackName: sub.track?.name ?? null,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    });
    subsByAuthor.set(sub.authorId, list);
  }

  // Compute stats
  let noSubmission = 0;
  let draftOnly = 0;
  let pendingAdvisor = 0;
  let submitted = 0;
  let accepted = 0;
  let rejected = 0;

  const authors: AuthorStatusRow[] = authorUsers.map((u) => {
    const subs = subsByAuthor.get(u.id) ?? [];

    if (subs.length === 0) {
      noSubmission++;
    } else {
      const statuses = subs.map((s) => s.status);
      const hasAccepted = statuses.includes("ACCEPTED") || statuses.includes("CAMERA_READY_PENDING") || statuses.includes("CAMERA_READY_SUBMITTED");
      const hasRejected = statuses.some((s) => s === "REJECTED" || s === "DESK_REJECTED");
      const hasPendingAdvisor = statuses.includes("ADVISOR_APPROVAL_PENDING");
      const hasSubmitted = statuses.some((s) =>
        ["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUIRED", "REBUTTAL"].includes(s)
      );
      const allDraft = statuses.every((s) => s === "DRAFT" || s === "WITHDRAWN");

      if (hasAccepted) accepted++;
      else if (hasRejected) rejected++;
      else if (hasSubmitted) submitted++;
      else if (hasPendingAdvisor) pendingAdvisor++;
      else if (allDraft) draftOnly++;
    }

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      affiliation: u.affiliation,
      prefixTh: u.prefixTh,
      firstNameTh: u.firstNameTh,
      lastNameTh: u.lastNameTh,
      prefixEn: u.prefixEn,
      firstNameEn: u.firstNameEn,
      lastNameEn: u.lastNameEn,
      submissions: subs,
    };
  });

  return {
    authors,
    stats: {
      totalAuthors: authors.length,
      noSubmission,
      draftOnly,
      pendingAdvisor,
      submitted,
      accepted,
      rejected,
    },
  };
}
