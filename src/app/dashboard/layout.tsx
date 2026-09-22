import { auth, signOut } from "@/auth";
import { AccountGate } from "@/components/account-gate";
import { ReferentPresenceProvider } from "@/components/online-referents";
import { LocalDatabaseSync } from "@/components/local-database-sync";
import { DashboardUserProvider } from "@/components/layout/dashboard-user";
import { DashboardPageGate } from "@/components/layout/dashboard-page-gate";
import { SideNavbar } from "@/components/layout/side-navbar";
import { displayDiscordId } from "@/lib/cve-access";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const discordId =
    session.user.discordId ||
    (displayDiscordId(session.user.id) || null) ||
    (/^\d{17,20}$/.test(session.user.id) ? session.user.id : null);

  const user = {
    id: session.user.id,
    name: session.user.name,
    image: session.user.image,
    discordLinked: Boolean(session.user.discordLinked),
    discordId,
    discordBannerUrl: session.user.discordBannerUrl ?? null,
    discordDecorationUrl: session.user.discordDecorationUrl ?? null,
    discordAccent: session.user.discordAccent ?? null,
  };

  return (
    <DashboardUserProvider user={user} signOutAction={signOutAction}>
      <LocalDatabaseSync>
      <AccountGate
        userId={user.id}
        userName={user.name}
        userImage={user.image}
        discordId={user.discordId}
        discordLinked={user.discordLinked}
        suggestedGrade={session.user.discordGrade ?? null}
        signOutAction={signOutAction}
      >
        <ReferentPresenceProvider>
        <div className="min-h-dvh bg-transparent">
          <SideNavbar
            userName={user.name}
            userImage={user.image}
            signOutAction={signOutAction}
          />
          <div className="relative min-h-dvh pl-[4.75rem] pr-3 lg:pl-[18.25rem] lg:pr-4">
            <DashboardPageGate>{children}</DashboardPageGate>
          </div>
        </div>
        </ReferentPresenceProvider>
      </AccountGate>
      </LocalDatabaseSync>
    </DashboardUserProvider>
  );
}
