import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/server/auth-helpers";
import { DeadlinesClient } from "./deadlines-client";
import { getDeadlinesPageData } from "@/server/deadlines-data";

export default async function DeadlinesPage() {
  const authContext = await getServerAuthContext();

  if (!authContext?.user.isActive) {
    redirect("/login");
  }

  const data = await getDeadlinesPageData();

  return (
    <DeadlinesClient
      initialTemplates={data.templates}
      initialSettings={data.settings}
    />
  );
}
