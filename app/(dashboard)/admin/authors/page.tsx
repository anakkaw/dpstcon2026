import { redirect } from "next/navigation";
import { hasRole } from "@/lib/permissions";
import { getServerAuthContext } from "@/server/auth-helpers";
import { getAdminAuthorStatusData } from "@/server/admin-author-status-data";
import { AdminAuthorStatusClient } from "./admin-author-status-client";

export default async function AdminAuthorStatusPage() {
  const authContext = await getServerAuthContext();

  if (!authContext?.user.isActive) {
    redirect("/login");
  }

  if (!hasRole(authContext.user, "ADMIN")) {
    redirect("/dashboard");
  }

  const { authors } = await getAdminAuthorStatusData();

  return <AdminAuthorStatusClient authors={authors} />;
}
