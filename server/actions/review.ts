"use server";

import { db } from "@/server/db";
import { reviews, reviewAssignments, decisions, submissions, presentationAssignments } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireActiveServerAuthContext } from "@/server/auth-helpers";
import { isDuplicateReviewRound } from "@/server/access-policies";
import { hasRole } from "@/lib/permissions";

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

  if (!assignment && !hasRole(user, "ADMIN")) {
    throw new Error("คุณไม่ได้รับมอบหมายให้รีวิวบทความนี้");
  }

  const assignmentIdToComplete = data.assignmentId || assignment?.id;
  const existingReview = assignmentIdToComplete
    ? await db.query.reviews.findFirst({
        where: and(
          eq(reviews.submissionId, data.submissionId),
          eq(reviews.reviewerId, session.user.id),
          eq(reviews.assignmentId, assignmentIdToComplete)
        ),
        columns: { id: true },
      })
    : await db.query.reviews.findFirst({
        where: and(
          eq(reviews.submissionId, data.submissionId),
          eq(reviews.reviewerId, session.user.id)
        ),
        columns: { id: true },
      });

  if (
    isDuplicateReviewRound({
      hasExistingReview: !!existingReview,
      assignmentStatus: assignment?.status,
      isAdminOverride: hasRole(user, "ADMIN") && !assignmentIdToComplete,
    })
  ) {
    throw new Error("มีรีวิวสำหรับรอบการพิจารณานี้แล้ว");
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
  const canDecide = hasRole(user, "ADMIN", "PROGRAM_CHAIR");
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
    const existingPresentations = await db.query.presentationAssignments.findMany({
      where: eq(presentationAssignments.submissionId, data.submissionId),
      columns: { type: true },
    });
    const existingTypes = new Set(existingPresentations.map((row) => row.type));
    const missingTypes = ["POSTER", "ORAL"].filter(
      (type) => !existingTypes.has(type as "POSTER" | "ORAL")
    );

    if (missingTypes.length > 0) {
      await db.insert(presentationAssignments).values(
        missingTypes.map((type) => ({
          submissionId: data.submissionId,
          type: type as "POSTER" | "ORAL",
          status: "PENDING" as const,
        }))
      );
    }
  }

  revalidatePath("/submissions");
  revalidatePath(`/submissions/${data.submissionId}`);
  revalidatePath("/presentations/oral");
  revalidatePath("/presentations/poster");
  return decision;
}
