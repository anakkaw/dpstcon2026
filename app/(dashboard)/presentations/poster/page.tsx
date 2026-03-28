import { redirect } from "next/navigation";
import { PresentationsClient } from "@/app/(dashboard)/presentations/presentations-client";
import { getServerAuthContext } from "@/server/auth-helpers";
import { getPresentationPageData } from "@/server/presentation-data";

export default async function PosterPresentationPage() {
  const authContext = await getServerAuthContext();

  if (!authContext?.user.isActive) {
    redirect("/login");
  }

  const data = await getPresentationPageData(authContext.user, "POSTER");

  return (
    <PresentationsClient
      type="POSTER"
      initialPresentations={data.presentations}
      initialCriteria={data.criteria}
      initialCommitteeUsers={data.committeeUsers}
    />
  );
}
