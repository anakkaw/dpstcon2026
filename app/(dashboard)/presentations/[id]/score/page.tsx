import { notFound, redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getServerAuthContext } from "@/server/auth-helpers";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import {
  posterSlotJudges,
  presentationAssignments,
  presentationCommitteeAssignments,
  presentationEvaluations,
  submissions,
} from "@/server/db/schema";
import { getPresentationRubric } from "@/server/presentation-rubrics";
import { ScoreForm } from "./score-form";

export default async function ScorePresentationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authContext = await getServerAuthContext();
  if (!authContext?.user.isActive) redirect("/login");

  const currentUser = authContext.user;
  const presentation = await db.query.presentationAssignments.findFirst({
    where: eq(presentationAssignments.id, id),
    with: {
      submission: {
        columns: { id: true, paperCode: true, title: true },
        with: {
          author: {
            columns: {
              name: true,
              prefixTh: true,
              firstNameTh: true,
              lastNameTh: true,
              prefixEn: true,
              firstNameEn: true,
              lastNameEn: true,
            },
          },
          track: { columns: { id: true, name: true } },
        },
      },
    },
  });

  if (!presentation) notFound();

  const isAdmin = hasRole(currentUser, "ADMIN");
  let assigned = isAdmin;

  if (!assigned) {
    const committeeAssignment = await db.query.presentationCommitteeAssignments.findFirst({
      where: and(
        eq(presentationCommitteeAssignments.presentationId, id),
        eq(presentationCommitteeAssignments.judgeId, currentUser.id)
      ),
    });
    assigned = Boolean(committeeAssignment);

    if (!assigned && presentation.type === "POSTER") {
      const posterSlot = await db.query.posterSlotJudges.findFirst({
        where: and(
          eq(posterSlotJudges.submissionId, presentation.submission.id),
          eq(posterSlotJudges.judgeId, currentUser.id)
        ),
      });
      assigned = Boolean(posterSlot);
    }
  }

  if (!assigned) {
    redirect("/presentations/scoring");
  }

  const [criteria, existing] = await Promise.all([
    getPresentationRubric(presentation.type as "ORAL" | "POSTER"),
    db.query.presentationEvaluations.findFirst({
      where: and(
        eq(presentationEvaluations.presentationId, id),
        eq(presentationEvaluations.judgeId, currentUser.id)
      ),
    }),
  ]);

  // Find the next pending presentation for this judge (skip current one)
  let nextPendingId: string | null = null;
  if (!isAdmin) {
    const [committeeRows, posterRows] = await Promise.all([
      db
        .select({ id: presentationCommitteeAssignments.presentationId })
        .from(presentationCommitteeAssignments)
        .where(eq(presentationCommitteeAssignments.judgeId, currentUser.id)),
      db
        .select({ id: presentationAssignments.id })
        .from(posterSlotJudges)
        .innerJoin(
          presentationAssignments,
          and(
            eq(posterSlotJudges.submissionId, presentationAssignments.submissionId),
            eq(presentationAssignments.type, "POSTER")
          )
        )
        .where(eq(posterSlotJudges.judgeId, currentUser.id)),
    ]);

    const otherIds = Array.from(
      new Set([
        ...committeeRows.map((r) => r.id),
        ...posterRows.map((r) => r.id),
      ])
    ).filter((pid) => pid !== id);

    if (otherIds.length > 0) {
      const [evaluatedRows, pendingDetails] = await Promise.all([
        db
          .select({ presentationId: presentationEvaluations.presentationId })
          .from(presentationEvaluations)
          .where(
            and(
              eq(presentationEvaluations.judgeId, currentUser.id),
              inArray(presentationEvaluations.presentationId, otherIds)
            )
          ),
        db
          .select({
            id: presentationAssignments.id,
            scheduledAt: presentationAssignments.scheduledAt,
            submissionStatus: submissions.status,
          })
          .from(presentationAssignments)
          .innerJoin(
            submissions,
            eq(presentationAssignments.submissionId, submissions.id)
          )
          .where(inArray(presentationAssignments.id, otherIds)),
      ]);

      const evaluatedSet = new Set(evaluatedRows.map((e) => e.presentationId));
      const pending = pendingDetails
        .filter(
          (row) =>
            !evaluatedSet.has(row.id) &&
            row.submissionStatus !== "WITHDRAWN" &&
            row.submissionStatus !== "DESK_REJECTED" &&
            row.submissionStatus !== "REJECTED"
        )
        .sort((a, b) => {
          const at = a.scheduledAt?.getTime() ?? Number.POSITIVE_INFINITY;
          const bt = b.scheduledAt?.getTime() ?? Number.POSITIVE_INFINITY;
          return at - bt;
        });

      nextPendingId = pending[0]?.id ?? null;
    }
  }

  return (
    <ScoreForm
      presentation={{
        id: presentation.id,
        type: presentation.type,
        status: presentation.status,
        scheduledAt: presentation.scheduledAt?.toISOString() ?? null,
        room: presentation.room,
        duration: presentation.duration,
        submission: {
          id: presentation.submission.id,
          paperCode: presentation.submission.paperCode,
          title: presentation.submission.title,
          author: presentation.submission.author,
          track: presentation.submission.track,
        },
      }}
      criteria={criteria}
      initialScores={(existing?.scores as Record<string, number> | null) ?? null}
      initialComments={existing?.comments ?? ""}
      hasExisting={Boolean(existing)}
      lastSavedAt={
        existing
          ? (existing.updatedAt ?? existing.createdAt)?.toISOString() ?? null
          : null
      }
      nextPendingId={nextPendingId}
    />
  );
}
