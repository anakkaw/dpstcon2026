import { cache } from "react";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { user as userTable, userRoles } from "./db/schema";

export type ServerAuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  roles: string[];
  isActive: boolean;
};

export const getServerAuthContext = cache(async function getServerAuthContext() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const [userRecord, roleRows] = await Promise.all([
    db.query.user.findFirst({
      where: eq(userTable.id, session.user.id),
      columns: { isActive: true },
    }),
    db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, session.user.id)),
  ]);

  if (!userRecord) return null;

  return {
    session,
    user: {
      ...(session.user as {
        id: string;
        name: string;
        email: string;
        role: string;
      }),
      roles: roleRows.length > 0 ? roleRows.map((row) => row.role) : [session.user.role as string],
      isActive: userRecord.isActive,
    } satisfies ServerAuthUser,
  };
});

export async function requireActiveServerAuthContext() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    throw new Error("Unauthorized");
  }

  if (!authContext.user.isActive) {
    throw new Error("Account not activated");
  }

  return authContext;
}
