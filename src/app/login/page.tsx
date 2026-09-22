import type { Metadata } from "next";
import { DiscordLoginButton } from "@/components/auth/discord-login-button";
import { LoginView } from "@/components/auth/login-view";

export const metadata: Metadata = {
  title: "Connexion · Référents GameMaster",
  description: "Espace privé des référents GameMaster",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const discordConfigured = Boolean(
    (process.env.DISCORD_CLIENT_ID?.trim() ||
      process.env.AUTH_DISCORD_ID?.trim()) &&
      (process.env.DISCORD_CLIENT_SECRET?.trim() ||
        process.env.AUTH_DISCORD_SECRET?.trim())
  );

  return (
    <LoginView discordConfigured={discordConfigured} authError={params.error}>
      <DiscordLoginButton />
    </LoginView>
  );
}
