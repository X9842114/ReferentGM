"use client";

import { PersonTile } from "@/components/person-tile";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { listAllAccounts, type RefgmAccount } from "@/lib/accounts";
import { getGradeDef } from "@/lib/grade-registry";
import { getGradeLabel, isListedReferent } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useDiscordUser, isDiscordSnowflake } from "@/hooks/use-discord-user";
import { pickDiscordAvatar } from "@/lib/discord-avatar";
import { listMissions, type StoredMission } from "@/lib/mission-storage";
import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ReferentsPanelProps = {
  currentUserId: string;
};

type DirectoryRow = {
  userId: string;
  displayName: string;
  avatarUrl: string;
  accent: string;
  gradeId: string;
  gradeLabel: string;
  gradeColor: string;
  gradeRank: number;
};

export function ReferentsPanel({ currentUserId }: ReferentsPanelProps) {
  const [accounts, setAccounts] = useState<RefgmAccount[]>([]);
  const [missions, setMissions] = useState<StoredMission[]>([]);
  const [q, setQ] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      void listAllAccounts().then(setAccounts);
      setMissions(listMissions());
    };
    refresh();
    window.addEventListener("refgm:accounts-updated", refresh);
    window.addEventListener("refgm:missions-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("refgm:accounts-updated", refresh);
      window.removeEventListener("refgm:missions-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const rows = useMemo<DirectoryRow[]>(() => {
    return accounts
      .filter((account) => {
        if (account.status !== "APPROVED") return false;
        if (!isListedReferent(account.grade)) return false;
        const label = getGradeLabel(account.grade).toLowerCase();
        return !/d[eé]veloppeur/.test(label);
      })
      .map((account) => {
        const def = getGradeDef(account.grade);
        return {
          userId: account.userId,
          displayName: account.displayName,
          avatarUrl: account.discordAvatarUrl,
          accent: def.color,
          gradeId: account.grade,
          gradeLabel: getGradeLabel(account.grade),
          gradeColor: def.color,
          gradeRank: def.rank,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "fr"));
  }, [accounts]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (gradeFilter && row.gradeId !== gradeFilter) return false;
      if (!query) return true;
      return (
        row.displayName.toLowerCase().includes(query) ||
        row.gradeLabel.toLowerCase().includes(query)
      );
    });
  }, [rows, q, gradeFilter]);

  const activityByUser = useMemo(() => {
    const map = new Map<string, { missions: number; lastAt: string | null }>();
    const touch = (userId: string, when?: string | null, mission = false) => {
      if (!userId) return;
      const prev = map.get(userId) ?? { missions: 0, lastAt: null };
      if (mission) prev.missions += 1;
      if (when) {
        const next = Date.parse(when);
        const cur = prev.lastAt ? Date.parse(prev.lastAt) : 0;
        if (Number.isFinite(next) && next >= cur) prev.lastAt = when;
      }
      map.set(userId, prev);
    };
    for (const mission of missions) {
      touch(mission.authorId ?? "", mission.updatedAt || mission.createdAt, true);
      for (const vote of mission.votes ?? []) {
        touch(vote.userId, vote.at, false);
      }
      for (const read of mission.reads ?? []) {
        touch(read.userId, read.at, false);
      }
    }
    return map;
  }, [missions]);

  const groups = useMemo(() => {
    const map = new Map<string, DirectoryRow[]>();
    for (const row of filtered) {
      const list = map.get(row.gradeId) ?? [];
      list.push(row);
      map.set(row.gradeId, list);
    }
    return [...map.entries()]
      .map(([gradeId, members]) => ({
        gradeId,
        label: members[0]?.gradeLabel ?? gradeId,
        color: members[0]?.gradeColor ?? "#38bdf8",
        rank: members[0]?.gradeRank ?? 99,
        members,
      }))
      .filter((group) => !/d[eé]veloppeur/i.test(group.label))
      .sort((a, b) => a.rank - b.rank);
  }, [filtered]);

  const gradeChips = useMemo(() => {
    const seen = new Map<string, { label: string; color: string; rank: number; n: number }>();
    for (const row of rows) {
      const prev = seen.get(row.gradeId);
      if (prev) prev.n += 1;
      else
        seen.set(row.gradeId, {
          label: row.gradeLabel,
          color: row.gradeColor,
          rank: row.gradeRank,
          n: 1,
        });
    }
    return [...seen.entries()]
      .map(([id, meta]) => ({ id, ...meta }))
      .sort((a, b) => a.rank - b.rank);
  }, [rows]);

  return (
    <StaffPageShell
      title="Référents"
      description="Annuaire classé par grade."
      className="max-w-6xl"
      actions={
        <Link
          href="/dashboard/profil"
          className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#0a0a0b]"
        >
          Mon profil
        </Link>
      }
    >
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un nom ou un grade…"
            className="rg-field rg-field-icon py-2.5 pr-3"
          />
        </div>
        {gradeChips.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setGradeFilter(null)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-medium",
                !gradeFilter
                  ? "border-violet-400/40 bg-violet-400/15 text-violet-100"
                  : "border-white/10 text-white/50 hover:text-white"
              )}
            >
              Tous · {rows.length}
            </button>
            {gradeChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() =>
                  setGradeFilter((cur) => (cur === chip.id ? null : chip.id))
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-medium",
                  gradeFilter === chip.id
                    ? "bg-white/10 text-white"
                    : "border-white/10 text-white/50 hover:text-white"
                )}
                style={
                  gradeFilter === chip.id
                    ? { borderColor: `${chip.color}88`, color: chip.color }
                    : { borderColor: `${chip.color}33` }
                }
              >
                {chip.label} · {chip.n}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rg-empty">
          <p className="text-sm text-white/50">
            {rows.length === 0 ? "Aucun référent" : "Aucun résultat"}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.gradeId} className="space-y-3">
              <div className="flex items-center gap-3">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: group.color }}
                />
                <h2 className="text-sm font-semibold text-white">
                  {group.label}
                </h2>
                <span className="text-xs text-white/35">
                  {group.members.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {group.members.map((row) => (
                  <DirectoryPerson
                    key={row.userId}
                    row={row}
                    mine={row.userId === currentUserId}
                    missions={activityByUser.get(row.userId)?.missions ?? 0}
                    lastAt={activityByUser.get(row.userId)?.lastAt ?? null}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </StaffPageShell>
  );
}

function formatLastActivity(iso: string | null) {
  if (!iso) return "·";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "·";
  const diff = Date.now() - t;
  const min = Math.max(0, Math.floor(diff / 60000));
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}j`;
  return new Date(t).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function DirectoryPerson({
  row,
  mine,
  missions,
  lastAt,
}: {
  row: DirectoryRow;
  mine: boolean;
  missions: number;
  lastAt: string | null;
}) {
  const lookup = useDiscordUser(
    isDiscordSnowflake(row.userId) ? row.userId : null
  );
  const name =
    lookup?.username && !isDiscordSnowflake(lookup.username)
      ? lookup.username
      : row.displayName;
  const avatar = pickDiscordAvatar(lookup?.avatarUrl, row.avatarUrl);

  return (
    <PersonTile
      name={name}
      role={row.gradeLabel}
      avatarUrl={avatar}
      decorationUrl={lookup?.decorationUrl}
      userId={row.userId}
      meta={`${missions} miss. · ${formatLastActivity(lastAt)}`}
      href={`/dashboard/referents/${encodeURIComponent(row.userId)}`}
      mine={mine}
      verified
    />
  );
}
