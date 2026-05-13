import { redirect } from "next/navigation";
import { hasRole } from "@/lib/permissions";
import { getServerAuthContext } from "@/server/auth-helpers";
import { getAdminConferenceDocs } from "@/server/admin-conference-docs-data";
import { AdminConferenceDocsClient } from "./admin-conference-docs-client";

export default async function AdminConferenceDocsPage() {
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

  const docs = await getAdminConferenceDocs();
  return <AdminConferenceDocsClient initialDocs={docs} />;
}
