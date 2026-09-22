"use client";

import { MetallicButton } from "@/components/ui/metallic-button";
import { useFormStatus } from "react-dom";

export function DiscordSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <MetallicButton
      type="submit"
      disabled={pending}
      fullWidth
      aria-busy={pending}
      label={pending ? "Connexion…" : "Continuer avec Discord"}
    />
  );
}
