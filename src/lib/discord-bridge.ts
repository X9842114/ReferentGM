import "server-only";

import type { DiscordBridgeEvent } from "@/lib/discord-events";
import { postDiscordLog } from "@/lib/discord-rest";

export type DiscordActor = {
  id: string;
  name?: string | null;
};

function mention(id?: string | null) {
  return id && /^\d{17,20}$/.test(id) ? `<@${id}>` : null;
}

function who(actor?: DiscordActor | null, fallbackName?: string | null) {
  const name = actor?.name?.trim() || fallbackName?.trim() || "Inconnu";
  const ping = mention(actor?.id);
  return ping ? `${name} · ${ping}` : name;
}

function field(name: string, value?: string | number | null) {
  if (value === undefined || value === null || value === "") return null;
  return { name, value: String(value), inline: true };
}

export async function dispatchDiscordEvent(
  event: DiscordBridgeEvent,
  actor?: DiscordActor | null
) {
  const base = {
    timestamp: new Date().toISOString(),
    footer: { text: "RefGM · log" },
  };

  if (event.type === "mission.pending") {
    return postDiscordLog({
      ...base,
      title: "Mission proposée",
      color: 0x38bdf8,
      fields: [
        field("Mission", event.title),
        field("Par", who(actor, event.authorName)),
        field("Durée", event.duration),
      ].filter(Boolean),
    });
  }

  if (event.type === "mission.vote") {
    return postDiscordLog({
      ...base,
      title: event.decision === "approve" ? "Vote pour" : "Vote contre",
      color: event.decision === "approve" ? 0x34d399 : 0xf87171,
      fields: [
        field("Mission", event.title),
        field("Par", who(actor, event.voterName)),
        field("Motif", event.reason),
      ].filter(Boolean),
    });
  }

  if (event.type === "mission.reviewed") {
    const ok = event.decision === "approved";
    return postDiscordLog({
      ...base,
      title: ok ? "Mission validée" : "Mission refusée",
      color: ok ? 0x34d399 : 0xf87171,
      fields: [
        field("Mission", event.title),
        field("Par", who(actor, event.reviewerName)),
        field("Auteur", event.authorName),
      ].filter(Boolean),
    });
  }

  if (event.type === "account.pending") {
    return postDiscordLog({
      ...base,
      title: "Nouveau compte en attente",
      color: 0xfbbf24,
      fields: [
        field("Compte", event.displayName),
        field("Discord", mention(event.userId) ?? event.userId),
      ].filter(Boolean),
    });
  }

  if (event.type === "account.reviewed") {
    const ok = event.decision === "APPROVED";
    return postDiscordLog({
      ...base,
      title: ok ? "Compte validé" : "Compte refusé",
      color: ok ? 0x34d399 : 0xf87171,
      fields: [
        field("Compte", event.displayName),
        field("Par", who(actor, event.reviewerName)),
        field("Grade", event.grade),
      ].filter(Boolean),
    });
  }

  if (event.type === "account.grade") {
    return postDiscordLog({
      ...base,
      title: "Changement de grade",
      color: 0xa78bfa,
      fields: [
        field("Compte", event.displayName),
        field("Grade", event.grade),
        field("Par", who(actor, event.actorName)),
      ].filter(Boolean),
    });
  }

  return null;
}
