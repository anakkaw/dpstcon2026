import { createMiddleware } from "hono/factory";
import { auth } from "@/server/auth";
import { HTTPException } from "hono/http-exception";
import { db } from "@/server/db";
import { user as userTable, userRoles } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string; // primary role (backward compat with Better Auth)
  roles: string[]; // all roles from user_roles table
};

type AuthEnv = {
  Variables: {
    user: SessionUser;
    session: { id: string };
  };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  // Fetch isActive check and roles in parallel (2 queries → 1 round-trip)
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

  if (!userRecord?.isActive) {
    throw new HTTPException(403, { message: "Account not activated" });
  }

  const roles = roleRows.map((r) => r.role);

  c.set("user", {
    ...(session.user as { id: string; name: string; email: string; role: string }),
    roles: roles.length > 0 ? roles : [session.user.role as string],
  });
  c.set("session", { id: session.session.id });
  await next();
});

export function requireRole(...requiredRoles: string[]) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.get("user");
    if (!user || !requiredRoles.some((r) => user.roles.includes(r))) {
      throw new HTTPException(403, { message: "Forbidden" });
    }
    await next();
  });
}
