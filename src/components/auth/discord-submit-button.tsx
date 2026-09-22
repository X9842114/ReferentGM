"use client";

import { MetallicButton } from "@/components/ui/metallic-button";
import { useFormStatus } from "react-dom";

export function DiscordSubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <MetallicButton
      type="submit"
      disabled={pending || disabled}
      fullWidth
      aria-busy={pending}
      label={pending ? "Connexion…" : "Continuer avec Discord"}
    />
  );
}
