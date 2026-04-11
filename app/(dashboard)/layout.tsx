import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DashboardAuthProvider } from "@/components/dashboard-auth-context";
import { ToastProvider } from "@/components/ui/toast";
import { getServerAuthContext } from "@/server/auth-helpers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  return (
    <ToastProvider>
      <AppShell user={authContext.user}>
        <DashboardAuthProvider user={authContext.user}>
          {children}
        </DashboardAuthProvider>
      </AppShell>
    </ToastProvider>
  );
}
