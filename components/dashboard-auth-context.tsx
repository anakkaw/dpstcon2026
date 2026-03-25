"use client";

import { createContext, useContext, type ReactNode } from "react";

export type DashboardAuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  roles: string[];
  prefixTh?: string | null;
  firstNameTh?: string | null;
  lastNameTh?: string | null;
  prefixEn?: string | null;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
};

const DashboardAuthContext = createContext<DashboardAuthUser | null>(null);

export function DashboardAuthProvider({
  user,
  children,
}: {
  user: DashboardAuthUser;
  children: ReactNode;
}) {
  return (
    <DashboardAuthContext.Provider value={user}>
      {children}
    </DashboardAuthContext.Provider>
  );
}

export function useDashboardAuth() {
  const value = useContext(DashboardAuthContext);
  if (!value) {
    throw new Error("useDashboardAuth must be used within DashboardAuthProvider");
  }
  return value;
}
