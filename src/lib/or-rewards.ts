import { findRpGroup, type GroupKind } from "@/lib/rp-groups";

export type OrColor = "bleu" | "rouge";

/** PF → Or Bleu | Gang / Orga → Or Rouge */
export function orColorForKind(kind: GroupKind): OrColor {
  return kind === "PF" ? "bleu" : "rouge";
}

export function orColorLabel(color: OrColor) {
  return color === "bleu" ? "Or Bleu" : "Or Rouge";
}

export function orColorIcon(color: OrColor) {
  return color === "bleu" ? "/or/or-bleu.png" : "/or/or-rouge.png";
}

/** Estime un montant d'Or à partir de la durée saisie (ex. "45 min", "1h30"). */
export function estimateOrFromDuration(duration: string): number {
  const raw = duration.toLowerCase().trim();
  let minutes = 0;

  const hourMatch = raw.match(/(\d+)\s*h(?:eures?)?/);
  const minMatch = raw.match(/(\d+)\s*m(?:in(?:utes?)?)?/);
  const plain = raw.match(/^(\d+)$/);

  if (hourMatch) minutes += Number(hourMatch[1]) * 60;
  if (minMatch) minutes += Number(minMatch[1]);
  if (!hourMatch && !minMatch && plain) minutes = Number(plain[1]);

  // "1h30" without "m"
  const hCompact = raw.match(/(\d+)\s*h\s*(\d+)/);
  if (hCompact) {
    minutes = Number(hCompact[1]) * 60 + Number(hCompact[2]);
  }

  if (minutes <= 0) minutes = 30; // défaut raisonnable

  // Barème simple : ~2 Or / minute, borné
  return Math.max(20, Math.min(400, Math.round(minutes * 2)));
}

export type GroupOrReward = {
  groupId: string;
  color: OrColor;
  amount: number;
};

export function computeOrRewards(
  groupIds: string[],
  duration: string,
  noGroup: boolean
): GroupOrReward[] {
  if (noGroup || groupIds.length === 0) return [];
  const amount = estimateOrFromDuration(duration);
  return groupIds
    .map((groupId) => {
      const group = findRpGroup(groupId);
      if (!group) return null;
      return {
        groupId,
        color: orColorForKind(group.kind),
        amount,
      } satisfies GroupOrReward;
    })
    .filter((x): x is GroupOrReward => Boolean(x));
}
