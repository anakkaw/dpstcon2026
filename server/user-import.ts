import { normalizeRoleList } from "@/lib/permissions";

export type BulkImportUserWithRoles = {
  email: string;
  roles: string[];
};

export function mergeBulkImportUsersByEmail<T extends BulkImportUserWithRoles>(
  users: T[]
): Array<Omit<T, "roles"> & { roles: string[] }> {
  const usersByEmail = new Map<string, Omit<T, "roles"> & { roles: string[] }>();

  for (const user of users) {
    const existing = usersByEmail.get(user.email);
    if (!existing) {
      usersByEmail.set(user.email, {
        ...user,
        roles: normalizeRoleList(user.roles),
      });
      continue;
    }

    existing.roles = normalizeRoleList([...existing.roles, ...user.roles]);
  }

  return Array.from(usersByEmail.values());
}
