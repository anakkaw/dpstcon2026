"use server";

import { db } from "@/server/db";
import { reviews, reviewAssignments, decisions, submissions, presentationAssignments } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireActiveServerAuthContext } from "@/server/auth-helpers";

export async function submitReview(data: {
  submissionId: string;
  assignmentId?: string;
  commentsToAuthor: string;
  commentsToChair?: string;
  recommendation: string;
}) {
  const { session, user } = await requireActiveServerAuthContext();

  // Verify reviewer has an assignment for this submission
  const assignment = await db.query.reviewAssignments.findFirst({
    where: and(
      eq(reviewAssignments.submissionId, data.submissionId),
      eq(reviewAssignments.reviewerId, session.user.id)
    ),
  });

  if (!assignment && !user.roles.includes("ADMIN")) {
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
  const { session, user } = await requireActiveServerAuthContext();

  // Only ADMIN or PROGRAM_CHAIR can make decisions
  const canDecide = user.roles.some((r) =>
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
    CONDITIONAL_ACCEPT: "REVISION_REQUIRED",
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
