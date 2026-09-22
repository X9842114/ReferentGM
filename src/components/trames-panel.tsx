"use client";

import { DiscordDecoratedAvatar } from "@/components/actor-trace";
import { useAccount } from "@/components/account-context";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { MetallicButton } from "@/components/ui/metallic-button";
import {
  discordDisplayName,
  isDiscordSnowflake,
  isPlaceholderDisplayName,
  useDiscordUser,
} from "@/hooks/use-discord-user";
import {
  GM_CELL_ROLE_LABEL,
  listGmCells,
  updateGmTrame,
  type GmCell,
  type GmCellMember,
} from "@/lib/gm-cells";
import { GROUP_KIND_CHIP, GROUP_KIND_LABEL, resolveRpGroup } from "@/lib/rp-groups";
import { cn } from "@/lib/utils";
import { ExternalLink, Plus, ScrollText, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function prettyLink(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function TramesPanel() {
  const { account } = useAccount();
  const [cells, setCells] = useState<GmCell[]>([]);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trameLabel, setTrameLabel] = useState("");
  const [trameStatus, setTrameStatus] = useState("");
  const [trameInfo, setTrameInfo] = useState("");
  const [trameLink, setTrameLink] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setCells(listGmCells());
    refresh();
    window.addEventListener("refgm:staff-updated", refresh);
    window.addEventListener("refgm:rp-groups-updated", refresh);
    return () => {
      window.removeEventListener("refgm:staff-updated", refresh);
      window.removeEventListener("refgm:rp-groups-updated", refresh);
    };
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return cells.filter((cell) => {
      if (!query) return true;
      const hay = [
        cell.groupName,
        resolveRpGroup(cell.groupName)?.name,
        cell.trameLabel,
        cell.trameInfo,
        cell.trameStatus,
        cell.trameLink,
        ...cell.members.map(
          (m) => `${m.displayName} ${m.discordId} ${m.uniqueId}`
        ),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [cells, q]);

  function openEdit(cell: GmCell) {
    setEditingId(cell.id);
    setTrameLabel(cell.trameLabel ?? "");
    setTrameStatus(cell.trameStatus ?? "");
    setTrameInfo(cell.trameInfo ?? "");
    setTrameLink(cell.trameLink ?? "");
  }

  function save() {
    if (!editingId) return;
    updateGmTrame(
      editingId,
      { trameLabel, trameStatus, trameInfo, trameLink },
      { id: account.userId, name: account.displayName }
    );
    setEditingId(null);
    setToast("Trame enregistrée.");
    window.setTimeout(() => setToast(null), 2000);
  }

  return (
    <StaffPageShell
      title="Trames"
      description="Suivi des trames GM : infos, lien Gdoc, équipe, IDs et perms IG."
      actions={
        cells.length === 0 ? (
          <Link href="/dashboard/gamemasters" className="rg-btn rg-btn-primary">
            <Plus className="h-3.5 w-3.5" />
            Recenser un groupe
          </Link>
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Groupe, trame, GM, ID…"
            className="rg-field rg-field-icon py-2.5 pr-3"
          />
        </div>
        {toast ? <p className="text-xs text-emerald-300">{toast}</p> : null}
      </div>

      {cells.length === 0 ? (
        <div className="rg-empty">
          <ScrollText className="mb-3 h-6 w-6 text-white/25" />
          <p className="text-sm text-white/50">
            Aucun groupe GM recensé. Crée-les dans GameMasters, puis reviens
            ici pour coller la trame et le Gdoc.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rg-empty">
          <p className="text-sm text-white/50">Aucun résultat.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((cell) => {
            const editing = editingId === cell.id;
            const href = cell.trameLink?.trim();
            const catalog = resolveRpGroup(cell.groupName);
            const groupLabel = catalog?.name || cell.groupName;
            const named = Boolean((cell.trameLabel ?? "").trim());
            const hasInfo = Boolean((cell.trameInfo ?? "").trim());
            const members = [...cell.members].sort((a, b) => {
              const order = { PRINCIPAL: 0, BRAS_DROIT: 1, BRAS_GAUCHE: 2 };
              return order[a.cellRole] - order[b.cellRole];
            });
            return (
              <article
                key={cell.id}
                className="rg-card flex flex-col overflow-hidden p-0"
              >
                <div className="flex items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold tracking-tight text-white">
                      {groupLabel}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-white/40">
                      {catalog ? (
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            GROUP_KIND_CHIP[catalog.kind]
                          )}
                        >
                          {GROUP_KIND_LABEL[catalog.kind]}
                        </span>
                      ) : null}
                      <span>
                        {cell.members.length} GM
                      </span>
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                      cell.trameStatus.trim()
                        ? "bg-violet-500/20 text-violet-100"
                        : "bg-white/[0.06] text-white/40"
                    )}
                  >
                    {cell.trameStatus.trim() || "Sans statut"}
                  </span>
                </div>

                <div className="flex-1 space-y-4 px-5 pb-4">
                {editing ? (
                  <div className="space-y-2">
                    <input
                      value={trameLabel}
                      onChange={(e) => setTrameLabel(e.target.value)}
                      className="rg-field py-2"
                      placeholder="Nom de la trame"
                    />
                    <input
                      value={trameStatus}
                      onChange={(e) => setTrameStatus(e.target.value)}
                      className="rg-field py-2"
                      placeholder="Avancement (ex. Chapitre 2)"
                    />
                    <input
                      value={trameLink}
                      onChange={(e) => setTrameLink(e.target.value)}
                      className="rg-field py-2"
                      placeholder="Lien Gdoc, Notion…"
                    />
                    <textarea
                      value={trameInfo}
                      onChange={(e) => setTrameInfo(e.target.value)}
                      rows={3}
                      className="rg-field resize-none py-2"
                      placeholder="Infos utiles pour les référents"
                    />
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <MetallicButton
                        type="button"
                        onClick={save}
                        label="Enregistrer"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rg-btn"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {named || hasInfo || href ? (
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                        <p className="text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">
                          Trame
                        </p>
                        <p className="mt-1.5 text-sm font-medium text-white">
                          {named ? cell.trameLabel : "Sans titre"}
                        </p>
                        {hasInfo ? (
                          <p className="mt-2 text-sm leading-relaxed text-white/50">
                            {cell.trameInfo}
                          </p>
                        ) : null}
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-violet-200 hover:text-white"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {prettyLink(href)}
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-7 text-center">
                        <ScrollText className="h-5 w-5 text-white/25" />
                        <p className="mt-2 text-sm text-white/55">Aucune trame</p>
                        <p className="mt-1 text-[11px] text-white/32">
                          Nom, infos et lien Gdoc à coller.
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">
                        Équipe GM
                      </p>
                      {members.length === 0 ? (
                        <p className="text-xs text-white/35">Aucun GM.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {members.map((m) => (
                            <MemberLine key={m.userId || m.discordId} member={m} />
                          ))}
                        </div>
                      )}
                    </div>
                    <MetallicButton
                      type="button"
                      fullWidth
                      onClick={() => openEdit(cell)}
                      label={named ? "Modifier la trame" : "Ajouter la trame"}
                    />
                  </>
                )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </StaffPageShell>
  );
}

function MemberLine({ member }: { member: GmCellMember }) {
  const discordId = member.discordId || member.userId;
  const lookup = useDiscordUser(
    isDiscordSnowflake(discordId) ? discordId : null
  );
  const name =
    discordDisplayName(lookup, member.displayName) ||
    (lookup?.status === "loading" ? "Profil Discord…" : "Sans nom");
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <DiscordDecoratedAvatar
        name={name}
        url={lookup?.avatarUrl}
        decorationUrl={lookup?.decorationUrl}
        userId={discordId}
        size={32}
        ringClassName="ring-2 ring-[#111113]"
        status={
          lookup?.inGuild
            ? "online"
            : lookup?.status === "ready"
              ? "offline"
              : undefined
        }
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white">
          {isPlaceholderDisplayName(name) ? "Profil Discord…" : name}
          <span className="text-white/40">
            {" "}
            · {GM_CELL_ROLE_LABEL[member.cellRole]}
          </span>
        </p>
        <p className="truncate text-[11px] text-white/35">
          {lookup?.handle ? `@${lookup.handle}` : discordId || "Pas d’ID Discord"}
          {member.uniqueId ? ` · ${member.uniqueId}` : ""}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
          member.permIg
            ? "bg-emerald-400/12 text-emerald-200"
            : "bg-white/[0.05] text-white/30"
        )}
      >
        {member.permIg ? "Perms IG" : "Sans perms"}
      </span>
    </div>
  );
}
