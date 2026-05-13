import { redirect } from "next/navigation";
import { hasRole } from "@/lib/permissions";
import { getServerAuthContext } from "@/server/auth-helpers";
import { getAdminPublicationsData } from "@/server/admin-publications-data";
import { AdminPublicationsClient } from "./admin-publications-client";

export default async function AdminPublicationsPage() {
  const authContext = await getServerAuthContext();

  if (!authContext?.user.isActive) {
    redirect("/login");
  }

  if (!hasRole(authContext.user, "ADMIN")) {
    redirect("/dashboard");
  }

  const submissions = await getAdminPublicationsData();

  return <AdminPublicationsClient initialSubmissions={submissions} />;
}
