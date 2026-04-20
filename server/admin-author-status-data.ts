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
  advisorName: string | null;
  advisorEmail: string | null;
  advisorApprovalStatus: string | null;
  advisorApprovalAt: string | null;
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

export async function getAdminAuthorStatusData(): Promise<{ authors: AuthorStatusRow[] }> {
  const authorRoleRows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.role, "AUTHOR"));

  const authorIds = [...new Set(authorRoleRows.map((r) => r.userId))];

  if (authorIds.length === 0) return { authors: [] };

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
        advisorName: true, advisorEmail: true,
        advisorApprovalStatus: true, advisorApprovalAt: true,
      },
      with: {
        track: { columns: { name: true } },
      },
    }),
  ]);

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
      advisorName: sub.advisorName,
      advisorEmail: sub.advisorEmail,
      advisorApprovalStatus: sub.advisorApprovalStatus,
      advisorApprovalAt: sub.advisorApprovalAt?.toISOString() ?? null,
    });
    subsByAuthor.set(sub.authorId, list);
  }

  const authors: AuthorStatusRow[] = authorUsers.map((u) => ({
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
    submissions: subsByAuthor.get(u.id) ?? [],
  }));

  return { authors };
}
