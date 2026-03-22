"use server";

import { db } from "@/server/db";
import { reviews, reviewAssignments, decisions, submissions, presentationAssignments, userRoles } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function getSessionWithRoles() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Load user's roles
  const roleRows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, session.user.id));
  const roles = roleRows.map((r) => r.role);

  return {
    ...session,
    roles: roles.length > 0 ? roles : [session.user.role as string],
  };
}

export async function submitReview(data: {
  submissionId: string;
  assignmentId?: string;
  commentsToAuthor: string;
  commentsToChair?: string;
  recommendation: string;
}) {
  const session = await getSessionWithRoles();

  // Verify reviewer has an assignment for this submission
  const assignment = await db.query.reviewAssignments.findFirst({
    where: and(
      eq(reviewAssignments.submissionId, data.submissionId),
      eq(reviewAssignments.reviewerId, session.user.id)
    ),
  });

  if (!assignment && !session.roles.includes("ADMIN")) {
    throw new Error("คุณไม่ได้รับมอบหมายให้รีวิวบทความนี้");
  }

  const [review] = await db
    .insert(reviews)
    .values({
      submissionId: data.submissionId,
      reviewerId: session.user.id,
      assignmentId: data.assignmentId || assignment?.id,
      commentsToAuthor: data.commentsToAuthor,
      commentsToChair: data.commentsToChair,
      recommendation: data.recommendation as typeof reviews.$inferInsert.recommendation,
      completedAt: new Date(),
    })
    .returning();

  const assignmentIdToComplete = data.assignmentId || assignment?.id;
  if (assignmentIdToComplete) {
    await db
      .update(reviewAssignments)
      .set({ status: "COMPLETED", respondedAt: new Date() })
      .where(eq(reviewAssignments.id, assignmentIdToComplete));
  }

  revalidatePath("/reviews");
  revalidatePath(`/submissions/${data.submissionId}`);
  return review;
}

export async function makeDecision(data: {
  submissionId: string;
  outcome: "ACCEPT" | "REJECT" | "CONDITIONAL_ACCEPT" | "DESK_REJECT";
  comments?: string;
  conditions?: string;
}) {
  const session = await getSessionWithRoles();

  // Only ADMIN or PROGRAM_CHAIR can make decisions
  const canDecide = session.roles.some((r) =>
    ["ADMIN", "PROGRAM_CHAIR"].includes(r)
  );
  if (!canDecide) {
    throw new Error("คุณไม่มีสิทธิ์ตัดสินบทความ");
  }

  const [decision] = await db
    .insert(decisions)
    .values({
      submissionId: data.submissionId,
      decidedBy: session.user.id,
      outcome: data.outcome,
      comments: data.comments,
      conditions: data.conditions,
    })
    .returning();

  const statusMap: Record<string, string> = {
    ACCEPT: "CAMERA_READY_PENDING",
    REJECT: "REJECTED",
    CONDITIONAL_ACCEPT: "ACCEPTED",
    DESK_REJECT: "DESK_REJECTED",
  };

  await db
    .update(submissions)
    .set({
      status: statusMap[data.outcome] as typeof submissions.$inferInsert.status,
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, data.submissionId));

  if (data.outcome === "ACCEPT" || data.outcome === "CONDITIONAL_ACCEPT") {
    await db.insert(presentationAssignments).values([
      { submissionId: data.submissionId, type: "POSTER", status: "PENDING" },
      { submissionId: data.submissionId, type: "ORAL", status: "PENDING" },
    ]);
  }

  revalidatePath("/submissions");
  revalidatePath(`/submissions/${data.submissionId}`);
  revalidatePath("/presentations/oral");
  revalidatePath("/presentations/poster");
  return decision;
}
