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
        initialGroups={data.groups}
        initialUngroupedPosters={data.ungroupedPosters}
        initialCommitteeUsers={data.committeeUsers}
      />
    );
  }

  if (hasRole(currentUser, "AUTHOR")) {
    const authorGroups = await getPosterGroupsForAuthor(currentUser.id);
    return <PosterPlannerClient mode="author" authorGroups={authorGroups} />;
  }

  if (hasRole(currentUser, "COMMITTEE")) {
    const committeeGroups = await getPosterGroupsForCommittee(currentUser.id);
    return <PosterPlannerClient mode="committee" committeeGroups={committeeGroups} />;
  }

  redirect("/presentations/oral");
}
