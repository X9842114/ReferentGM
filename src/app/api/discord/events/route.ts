import { dispatchDiscordEvent } from "@/lib/discord-bridge";
import type { DiscordBridgeEvent } from "@/lib/discord-events";
import { discordPublicStatus } from "@/lib/discord-rest";
import {
  canManageGrades,
  canProposeMissions,
  canReadMissions,
  canVerifyAccounts,
} from "@/lib/permissions";
import {
  jsonAuthError,
  requireApprovedAccount,
} from "@/lib/server-authorization";

const ALLOWED = new Set<DiscordBridgeEvent["type"]>([
  "mission.pending",
  "mission.vote",
  "mission.reviewed",
  "account.pending",
  "account.reviewed",
  "account.grade",
]);

export async function GET() {
  return Response.json(discordPublicStatus());
}

export async function POST(request: Request) {
  try {
    const actor = await requireApprovedAccount();
    const event = (await request.json().catch(() => null)) as DiscordBridgeEvent | null;
    if (!event?.type || !ALLOWED.has(event.type)) {
      return Response.json({ error: "Événement invalide." }, { status: 400 });
    }

    const grade = actor.grade;
    const ok =
      (event.type.startsWith("mission.") &&
        (canProposeMissions(grade) || canReadMissions(grade))) ||
      (event.type === "account.pending" &&
        (canVerifyAccounts(grade) || canProposeMissions(grade))) ||
      (event.type === "account.reviewed" && canVerifyAccounts(grade)) ||
      (event.type === "account.grade" && canManageGrades(grade));
    if (!ok) {
      return Response.json({ error: "Permission insuffisante." }, { status: 403 });
    }

    const stamped: DiscordBridgeEvent = {
      ...event,
      ...(event.type === "mission.pending"
        ? { authorName: actor.displayName }
        : {}),
      ...(event.type === "mission.vote"
        ? { voterName: actor.displayName }
        : {}),
      ...(event.type === "mission.reviewed"
        ? { reviewerName: actor.displayName }
        : {}),
      ...(event.type === "account.reviewed" || event.type === "account.grade"
        ? { reviewerName: actor.displayName, actorName: actor.displayName }
        : {}),
    } as DiscordBridgeEvent;

    await dispatchDiscordEvent(stamped, {
      id: actor.userId,
      name: actor.displayName,
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return jsonAuthError(error);
    console.warn("[refgm] discord log", error);
    return Response.json({ ok: false }, { status: 502 });
  }
}
