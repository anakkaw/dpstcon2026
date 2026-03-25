import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DashboardAuthProvider } from "@/components/dashboard-auth-context";
import { getServerAuthContext } from "@/server/auth-helpers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authContext = await getServerAuthContext();

  if (!authContext?.user.isActive) {
    redirect("/login");
  }

  return (
    <DashboardAuthProvider user={authContext.user}>
      <AppShell>{children}</AppShell>
    </DashboardAuthProvider>
  );
}
