import { redirect } from "next/navigation";
import { hasRole } from "@/lib/permissions";
import { getServerAuthContext } from "@/server/auth-helpers";
import { getConferenceInfo } from "@/server/conference-info-data";
import { AdminConferenceInfoClient } from "./admin-conference-info-client";

export default async function AdminConferenceInfoPage() {
  const authContext = await getServerAuthContext();

  if (!authContext?.user.isActive) {
    redirect("/login");
  }

  if (
    !hasRole(authContext.user, "ADMIN") &&
    !hasRole(authContext.user, "PROGRAM_CHAIR")
  ) {
    redirect("/dashboard");
  }

  const info = await getConferenceInfo();
  return <AdminConferenceInfoClient initialInfo={info} />;
}
