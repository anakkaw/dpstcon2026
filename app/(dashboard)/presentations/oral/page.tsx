import { redirect } from "next/navigation";
import { PresentationsClient } from "@/app/(dashboard)/presentations/presentations-client";
import { getServerAuthContext } from "@/server/auth-helpers";
import { getPresentationPageData } from "@/server/presentation-data";
import { hasRole } from "@/lib/permissions";

export default async function OralPresentationPage() {
  const authContext = await getServerAuthContext();

  if (!authContext?.user.isActive) {
    redirect("/login");
  }

  const data = await getPresentationPageData(authContext.user, "ORAL");
  const canManage = hasRole(authContext.user, "ADMIN", "PROGRAM_CHAIR");

  return (
    <PresentationsClient
      type="ORAL"
      initialPresentations={data.presentations}
      initialCriteria={data.criteria}
      initialCommitteeUsers={data.committeeUsers}
      canManage={canManage}
    />
  );
}
