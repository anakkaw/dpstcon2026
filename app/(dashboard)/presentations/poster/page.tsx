import { redirect } from "next/navigation";
import { PosterPlannerClient } from "@/app/(dashboard)/presentations/poster/poster-planner-client";
import { getServerAuthContext } from "@/server/auth-helpers";
import {
  getPosterGroupsForAuthor,
  getPosterGroupsForCommittee,
  getPosterPlannerPageData,
} from "@/server/poster-planner-data";
import { hasRole } from "@/lib/permissions";

export default async function PosterPresentationPage() {
  const authContext = await getServerAuthContext();

  if (!authContext?.user.isActive) {
    redirect("/login");
  }

  const currentUser = authContext.user;

  if (hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    const data = await getPosterPlannerPageData(currentUser);

    return (
      <PosterPlannerClient
        mode="admin"
        initialSessionSettings={data.sessionSettings}
        initialGroups={data.groups}
        initialUngroupedPosters={data.ungroupedPosters}
        initialCommitteeUsers={data.committeeUsers}
      />
    );
  }

  const hasAuthorRole = hasRole(currentUser, "AUTHOR");
  const hasCommitteeRole = hasRole(currentUser, "COMMITTEE");

  if (hasAuthorRole || hasCommitteeRole) {
    const [authorGroups, committeeGroups] = await Promise.all([
      hasAuthorRole ? getPosterGroupsForAuthor(currentUser.id) : Promise.resolve([]),
      hasCommitteeRole ? getPosterGroupsForCommittee(currentUser.id) : Promise.resolve([]),
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
        authorGroups={authorGroups}
        committeeGroups={committeeGroups}
      />
    );
  }

  redirect("/presentations/oral");
}
