// Role priority for determining primary role (stored on user.role for Better Auth compat)
export const ROLE_PRIORITY: Record<string, number> = {
  ADMIN: 0,
  PROGRAM_CHAIR: 1,
  COMMITTEE: 2,
  REVIEWER: 3,
  AUTHOR: 4,
};

export type RoleAssignment = {
  role: string;
  trackId: string | null;
};

export type UserWithRoles = {
  id: string;
  name: string;
  email: string;
  role: string; // primary role for backward compat
  roles: string[]; // all roles from user_roles table
  roleAssignments?: RoleAssignment[];
};

/** Check if user has ANY of the specified roles */
export function hasRole(
  user: { roles?: string[]; role?: string },
  ...roles: string[]
): boolean {
  const userRoles = user.roles ?? (user.role ? [user.role] : []);
  return roles.some((r) => userRoles.includes(r));
}

/** Return normalized role assignments, preserving track scope when available. */
export function getRoleAssignments(
  user: { role?: string; roles?: string[]; roleAssignments?: RoleAssignment[] }
): RoleAssignment[] {
  if (user.roleAssignments && user.roleAssignments.length > 0) {
    return user.roleAssignments;
  }

  return (user.roles ?? (user.role ? [user.role] : [])).map((role) => ({
    role,
    trackId: null,
  }));
}

/** Check if user has a role assignment for a specific track. */
export function hasTrackRole(
  user: { role?: string; roles?: string[]; roleAssignments?: RoleAssignment[] },
  trackId: string | null | undefined,
  ...roles: string[]
): boolean {
  if (!trackId) return false;

  return getRoleAssignments(user).some(
    (assignment) =>
      assignment.trackId === trackId && roles.includes(assignment.role)
  );
}

/** Return track IDs where the user holds any of the specified scoped roles. */
export function getTrackRoleIds(
  user: { role?: string; roles?: string[]; roleAssignments?: RoleAssignment[] },
  ...roles: string[]
): string[] {
  return Array.from(
    new Set(
      getRoleAssignments(user)
        .filter(
          (assignment) =>
            assignment.trackId && roles.includes(assignment.role)
        )
        .map((assignment) => assignment.trackId as string)
    )
  );
}

/** Determine the highest-priority role from a list */
export function getPrimaryRole(roles: string[]): string {
  if (roles.length === 0) return "AUTHOR";
  return [...roles].sort(
    (a, b) => (ROLE_PRIORITY[a] ?? 99) - (ROLE_PRIORITY[b] ?? 99)
  )[0];
}
