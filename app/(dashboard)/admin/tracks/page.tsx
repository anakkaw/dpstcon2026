import { redirect } from "next/navigation";
import { hasRole } from "@/lib/permissions";
import { getServerAuthContext } from "@/server/auth-helpers";
import { getAdminTracksPageData } from "@/server/admin-tracks-data";
import { AdminTracksClient } from "./admin-tracks-client";

export default async function AdminTracksPage() {
  const authContext = await getServerAuthContext();

  if (!authContext?.user.isActive) {
    redirect("/login");
  }

  if (!hasRole(authContext.user, "ADMIN")) {
    redirect("/dashboard");
  }

  const data = await getAdminTracksPageData();

  return (
    <AdminTracksClient
      initialTracks={data.tracks}
      initialUsers={data.users}
    />
  );
}
