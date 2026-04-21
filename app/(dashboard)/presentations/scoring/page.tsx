import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getServerAuthContext } from "@/server/auth-helpers";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import {
  presentationAssignments,
  presentationCommitteeAssignments,
  presentationEvaluations,
} from "@/server/db/schema";
import { getPresentationRubrics } from "@/server/presentation-rubrics";
import { ScoringListClient, type ScoringListItem } from "./scoring-list-client";

export default async function ScoringHubPage() {
  const authContext = await getServerAuthContext();
  if (!authContext?.user.isActive) redirect("/login");

  const currentUser = authContext.user;
  if (!hasRole(currentUser, "COMMITTEE", "ADMIN")) {
    redirect("/dashboard");
  }

  const isAdmin = hasRole(currentUser, "ADMIN");

  const assignments = isAdmin
    ? await db
        .select({ presentationId: presentationAssignments.id })
        .from(presentationAssignments)
    : await db
        .select({ presentationId: presentationCommitteeAssignments.presentationId })
        .from(presentationCommitteeAssignments)
        .where(eq(presentationCommitteeAssignments.judgeId, currentUser.id));

  const presentationIds = Array.from(new Set(assignments.map((a) => a.presentationId)));

  if (presentationIds.length === 0) {
    return (
      <ScoringListClient
        items={[]}
        criteriaTotals={{ ORAL: 0, POSTER: 0 }}
      />
    );
  }

  const [presentations, evaluations, rubrics] = await Promise.all([
    db.query.presentationAssignments.findMany({
      where: inArray(presentationAssignments.id, presentationIds),
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
    }),
    db.query.presentationEvaluations.findMany({
      where: and(
        inArray(presentationEvaluations.presentationId, presentationIds),
        eq(presentationEvaluations.judgeId, currentUser.id)
      ),
    }),
    getPresentationRubrics(["ORAL", "POSTER"]),
  ]);

  const criteriaTotals = {
    ORAL: rubrics.ORAL.reduce((sum, c) => sum + c.totalPoints, 0),
    POSTER: rubrics.POSTER.reduce((sum, c) => sum + c.totalPoints, 0),
  };

  const evaluationByPresentation = new Map(
    evaluations.map((e) => [e.presentationId, e])
  );

  const items: ScoringListItem[] = presentations.map((p) => {
    const evaluation = evaluationByPresentation.get(p.id);
    const scores = (evaluation?.scores as Record<string, number> | null) ?? null;
    const earnedTotal = scores
      ? Object.values(scores).reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0)
      : 0;

    return {
      presentationId: p.id,
      type: p.type,
      status: p.status,
      scheduledAt: p.scheduledAt?.toISOString() ?? null,
      room: p.room,
      submission: {
        paperCode: p.submission.paperCode,
        title: p.submission.title,
        author: p.submission.author,
        track: p.submission.track,
      },
      hasEvaluation: Boolean(evaluation),
      earnedTotal,
    };
  });

  items.sort((a, b) => {
    if (a.hasEvaluation !== b.hasEvaluation) return a.hasEvaluation ? 1 : -1;
    const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
    const bt = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
    return at - bt;
  });

  return <ScoringListClient items={items} criteriaTotals={criteriaTotals} />;
}
