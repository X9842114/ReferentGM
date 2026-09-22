import { isDiscordConfigured, signIn } from "@/auth";
import { DiscordSubmitButton } from "@/components/auth/discord-submit-button";

export function DiscordLoginButton() {
  return (
    <form
      action={async () => {
        "use server";
        if (!isDiscordConfigured) {
          // Sans clés OAuth : session invitée pour accéder au dashboard
          await signIn("guest", { redirectTo: "/dashboard?welcome=1" });
          return;
        }
        await signIn("discord", { redirectTo: "/dashboard?welcome=1" });
      }}
      className="w-full"
    >
      <DiscordSubmitButton />
    </form>
  );
}
