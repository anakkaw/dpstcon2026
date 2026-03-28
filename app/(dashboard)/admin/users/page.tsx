import { redirect } from "next/navigation";
import { hasRole } from "@/lib/permissions";
import { getServerAuthContext } from "@/server/auth-helpers";
import { getAdminUsersPageData } from "@/server/admin-users-data";
import { AdminUsersClient } from "./admin-users-client";

export default async function AdminUsersPage() {
  const authContext = await getServerAuthContext();

  if (!authContext?.user.isActive) {
    redirect("/login");
  }

  if (!hasRole(authContext.user, "ADMIN")) {
    redirect("/dashboard");
  }

  const data = await getAdminUsersPageData();

  return (
    <AdminUsersClient
      initialUsers={data.users}
      initialRegStats={data.registrationStats}
    />
  );
}
