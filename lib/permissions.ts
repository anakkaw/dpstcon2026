// Role priority for determining primary role (stored on user.role for Better Auth compat)
export const ROLE_PRIORITY: Record<string, number> = {
  ADMIN: 0,
  PROGRAM_CHAIR: 1,
  COMMITTEE: 2,
  REVIEWER: 3,
  AUTHOR: 4,
};

export type UserWithRoles = {
  id: string;
  name: string;
  email: string;
  role: string; // primary role for backward compat
  roles: string[]; // all roles from user_roles table
};

/** Check if user has ANY of the specified roles */
export function hasRole(
  user: { roles?: string[]; role?: string },
  ...roles: string[]
): boolean {
  const userRoles = user.roles ?? (user.role ? [user.role] : []);
  return roles.some((r) => userRoles.includes(r));
}

/** Determine the highest-priority role from a list */
export function getPrimaryRole(roles: string[]): string {
  if (roles.length === 0) return "AUTHOR";
  return [...roles].sort(
    (a, b) => (ROLE_PRIORITY[a] ?? 99) - (ROLE_PRIORITY[b] ?? 99)
  )[0];
}
