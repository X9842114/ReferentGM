import { isDiscordConfigured, signIn } from "@/auth";
import { DiscordSubmitButton } from "@/components/auth/discord-submit-button";

export function DiscordLoginButton({ enabled }: { enabled: boolean }) {
  return (
    <form
      action={async () => {
        "use server";
        if (!isDiscordConfigured) return;
        await signIn("discord", { redirectTo: "/dashboard?welcome=1" });
      }}
      className="w-full"
    >
      <DiscordSubmitButton disabled={!enabled} />
    </form>
  );
}
