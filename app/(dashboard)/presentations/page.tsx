import { redirect } from "next/navigation";
import { PresentationsClient } from "@/app/(dashboard)/presentations/presentations-client";
import { PosterPlannerClient } from "@/app/(dashboard)/presentations/poster/poster-planner-client";
import { getServerAuthContext } from "@/server/auth-helpers";
import { getPresentationPageData } from "@/server/presentation-data";
import {
  getPosterSlotsForAuthor,
  getPosterSlotsForCommittee,
  getPosterPlannerPageData,
} from "@/server/poster-planner-data";
import { getPresentationRubric } from "@/server/presentation-rubrics";
import { hasRole } from "@/lib/permissions";
import { PresentationsTabs } from "./presentations-tabs";

type TabValue = "oral" | "poster";

function normalizeTab(raw: string | string[] | undefined): TabValue {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "poster" ? "poster" : "oral";
}

export default async function PresentationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const authContext = await getServerAuthContext();
  if (!authContext?.user.isActive) redirect("/login");

  const currentUser = authContext.user;
  const params = await searchParams;
  const activeTab = normalizeTab(params.tab);
  const canManage = hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR");
  const canEditCriteria = hasRole(currentUser, "ADMIN");

  if (activeTab === "oral") {
    const data = await getPresentationPageData(currentUser, "ORAL");
    return (
      <PresentationsTabs activeTab="oral">
        <PresentationsClient
          type="ORAL"
          initialPresentations={data.presentations}
          initialCriteria={data.criteria}
          initialCommitteeUsers={data.committeeUsers}
          canManage={canManage}
          canEditCriteria={canEditCriteria}
        />
      </PresentationsTabs>
    );
  }

  // poster tab — reuses the existing page.tsx logic
  const criteria = await getPresentationRubric("POSTER");
  if (canManage) {
    const data = await getPosterPlannerPageData(currentUser);
    return (
      <PresentationsTabs activeTab="poster">
        <PosterPlannerClient
          mode="admin"
          initialSessionSettings={data.sessionSettings}
          initialPosterSubmissions={data.posterSubmissions}
          initialCommitteeUsers={data.committeeUsers}
          criteria={criteria}
          canEditCriteria={canEditCriteria}
        />
      </PresentationsTabs>
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
      <PresentationsTabs activeTab="poster">
        <PosterPlannerClient
          mode={mode}
          authorSlots={authorSlots}
          committeeSlots={committeeSlots}
          criteria={criteria}
        />
      </PresentationsTabs>
    );
  }

  // fall back to oral view for users with no poster-relevant role
  redirect("/presentations?tab=oral");
}
