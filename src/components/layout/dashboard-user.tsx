"use client";

import { createContext, useContext, type ReactNode } from "react";

export type DashboardUser = {
  id: string;
  name?: string | null;
  image?: string | null;
  discordLinked: boolean;
  discordId?: string | null;
  discordBannerUrl?: string | null;
  discordDecorationUrl?: string | null;
  discordAccent?: string | null;
};

const DashboardUserContext = createContext<DashboardUser | null>(null);
const SignOutContext = createContext<(() => Promise<void>) | null>(null);

export function DashboardUserProvider({
  user,
  signOutAction,
  children,
}: {
  user: DashboardUser;
  signOutAction: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <DashboardUserContext.Provider value={user}>
      <SignOutContext.Provider value={signOutAction}>
        {children}
      </SignOutContext.Provider>
    </DashboardUserContext.Provider>
  );
}

export function useDashboardUser() {
  const user = useContext(DashboardUserContext);
  if (!user) {
    throw new Error("useDashboardUser must be used within DashboardUserProvider");
  }
  return user;
}

export function useSignOutAction() {
  const action = useContext(SignOutContext);
  if (!action) {
    throw new Error("useSignOutAction must be used within DashboardUserProvider");
  }
  return action;
}
