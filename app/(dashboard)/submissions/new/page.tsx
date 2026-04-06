import { redirect } from "next/navigation";
import { hasRole } from "@/lib/permissions";
import { getServerAuthContext } from "@/server/auth-helpers";
import { NewSubmissionClient } from "./new-submission-client";

export default async function NewSubmissionPage() {
  const authContext = await getServerAuthContext();

  if (!authContext?.user.isActive) {
    redirect("/login");
  }

  if (!hasRole(authContext.user, "AUTHOR")) {
    redirect("/submissions");
  }

  return <NewSubmissionClient />;
}
