import { redirect } from "next/navigation";
import { PosterPlannerClient } from "@/app/(dashboard)/presentations/poster/poster-planner-client";
import { getServerAuthContext } from "@/server/auth-helpers";
import {
  getPosterSlotsForAuthor,
  getPosterSlotsForCommittee,
  getPosterPlannerPageData,
} from "@/server/poster-planner-data";
import { hasRole } from "@/lib/permissions";
import { getPresentationRubric } from "@/server/presentation-rubrics";

export default async function PosterPresentationPage() {
  const authContext = await getServerAuthContext();

  if (!authContext?.user.isActive) {
    redirect("/login");
  }

  const currentUser = authContext.user;
  const criteria = await getPresentationRubric("POSTER");

  if (hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    const data = await getPosterPlannerPageData(currentUser);

    return (
      <PosterPlannerClient
        mode="admin"
        initialSessionSettings={data.sessionSettings}
        initialPosterSubmissions={data.posterSubmissions}
        initialCommitteeUsers={data.committeeUsers}
        criteria={criteria}
        canEditCriteria={hasRole(currentUser, "ADMIN")}
      />
    );
  }

  const hasAuthorRole = hasRole(currentUser, "AUTHOR");
  const hasCommitteeRole = hasRole(currentUser, "COMMITTEE");

  if (hasAuthorRole || hasCommitteeRole) {
    const [authorSlots, committeeSlots] = await Promise.all([
      hasAuthorRole ? getPosterSlotsForAuthor(currentUser.id) : Promise.resolve([]),
      hasCommitteeRole ? getPosterSlotsForCommittee(currentUser.id) : Promise.resolve([]),
    ]);

    const mode =
      hasAuthorRole && hasCommitteeRole
        ? "hybrid"
        : hasAuthorRole
          ? "author"
          : "committee";

    return (
      <PosterPlannerClient
        mode={mode}
        authorSlots={authorSlots}
        committeeSlots={committeeSlots}
        criteria={criteria}
      />
    );
  }

  redirect("/presentations/oral");
}
