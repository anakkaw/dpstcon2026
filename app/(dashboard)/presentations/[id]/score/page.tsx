import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getServerAuthContext } from "@/server/auth-helpers";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import {
  presentationAssignments,
  presentationCommitteeAssignments,
  presentationEvaluations,
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
  const assignment = await db.query.presentationCommitteeAssignments.findFirst({
    where: and(
      eq(presentationCommitteeAssignments.presentationId, id),
      eq(presentationCommitteeAssignments.judgeId, currentUser.id)
    ),
  });

  if (!assignment && !isAdmin) {
    redirect(
      presentation.type === "POSTER" ? "/presentations/poster" : "/presentations/oral"
    );
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
    />
  );
}
