export type DiscordBridgeEvent =
  | {
      type: "mission.pending";
      title: string;
      authorName?: string | null;
      duration?: string | null;
    }
  | {
      type: "mission.vote";
      title: string;
      decision: "approve" | "reject";
      voterName?: string | null;
      reason?: string | null;
    }
  | {
      type: "mission.reviewed";
      title: string;
      decision: "approved" | "rejected";
      reviewerName?: string | null;
      authorName?: string | null;
    }
  | {
      type: "account.pending";
      displayName: string;
      userId: string;
    }
  | {
      type: "account.reviewed";
      displayName: string;
      userId: string;
      decision: "APPROVED" | "REJECTED";
      grade?: string | null;
      reviewerName?: string | null;
    }
  | {
      type: "account.grade";
      displayName: string;
      userId: string;
      grade: string;
      actorName?: string | null;
    };

export function emitDiscordEvent(event: DiscordBridgeEvent) {
  if (typeof window === "undefined") return;
  void fetch("/api/discord/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  }).catch(() => {});
}
