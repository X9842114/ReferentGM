"use client";

import { MetallicButton } from "@/components/ui/metallic-button";
import { DiscordAvatar, DiscordDecoratedAvatar } from "@/components/actor-trace";
import { useAccount } from "@/components/account-context";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { OrIcon } from "@/components/or-icon";
import { listAllAccounts, type RefgmAccount } from "@/lib/accounts";
import {
  deleteGmCell,
  GM_CELL_ROLE_LABEL,
  listGmCells,
  saveGmCell,
  type GmCell,
  type GmCellMember,
  type GmCellRoleId,
} from "@/lib/gm-cells";
import { canAccessReferentHq, canManageGameMasters } from "@/lib/permissions";
import { SuiviManageActions } from "@/components/suivi-editor";
import { cn } from "@/lib/utils";
import {
  discordDisplayName,
  isDiscordSnowflake,
  isPlaceholderDisplayName,
  parseDiscordId,
  useDiscordUser,
} from "@/hooks/use-discord-user";
import { getGradeLabel } from "@/lib/grades";
import { pickDiscordAvatar } from "@/lib/discord-avatar";
import { summarizeGmCellActivity } from "@/lib/gm-cell-activity";
import { MapPin, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SlotState = {
  userId: string;
  uniqueId: string;
  discordId: string;
  displayName: string;
  permIg: boolean;
  enabled: boolean;
};

function SlotFields({
  label,
  slot,
  setSlot,
  required,
}: {
  label: string;
  slot: SlotState;
  setSlot: (s: SlotState) => void;
  required?: boolean;
}) {
  const hasId = isDiscordSnowflake(slot.discordId);
  const lookup = useDiscordUser(hasId ? slot.discordId : null);
  const resolvedName = discordDisplayName(lookup, slot.displayName);
  const avatar = pickDiscordAvatar(lookup?.avatarUrl);
  const loading = Boolean(hasId && lookup?.status === "loading");
  const ready = Boolean(resolvedName && !isPlaceholderDisplayName(resolvedName));

  useEffect(() => {
    if (!lookup?.id) return;
    if (parseDiscordId(slot.discordId) !== lookup.id) return;
    const name = discordDisplayName(lookup, "");
    if (!name) return;
    const nextUserId =
      slot.userId && !isDiscordSnowflake(slot.userId)
        ? slot.userId
        : lookup.id;
    if (
      slot.discordId === lookup.id &&
      slot.userId === nextUserId &&
      slot.displayName === name
    ) {
      return;
    }
    setSlot({
      ...slot,
      userId: nextUserId,
      discordId: lookup.id,
      displayName: name,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync Discord lookup into the slot
  }, [lookup?.id, lookup?.username, lookup?.handle, lookup?.status]);

  return (
    <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-black/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-white/70">{label}</p>
        {!required ? (
          <label className="flex items-center gap-1.5 text-[11px] text-white/40">
            <input
              type="checkbox"
              checked={slot.enabled}
              onChange={(e) =>
                setSlot({
                  ...slot,
                  enabled: e.target.checked,
                  discordId: e.target.checked ? slot.discordId : "",
                  userId: e.target.checked ? slot.userId : "",
                })
              }
            />
            Activer
          </label>
        ) : null}
      </div>
      {(required || slot.enabled) && (
        <>
          <div className="flex items-center gap-3">
            <DiscordDecoratedAvatar
              name={resolvedName || (hasId ? slot.discordId : "GM")}
              url={avatar}
              decorationUrl={lookup?.decorationUrl}
              userId={hasId ? slot.discordId : undefined}
              size={48}
              status={ready ? "online" : hasId ? "offline" : undefined}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {ready
                  ? resolvedName
                  : loading
                    ? "Chargement du profil…"
                    : hasId
                      ? "ID Discord détecté"
                      : "En attente de l’ID"}
              </p>
              <p className="text-[11px] text-white/40">
                {ready
                  ? lookup?.handle
                    ? `@${lookup.handle}`
                    : "Profil Discord chargé"
                  : loading
                    ? "Lecture du compte Discord…"
                    : hasId
                      ? slot.discordId
                      : "Colle un ID Discord"}
              </p>
              {ready && lookup?.inGuild ? (
                <p className="mt-1 truncate text-[10px] text-emerald-300/80">
                  {lookup.grade
                    ? getGradeLabel(lookup.grade)
                    : lookup.roles[0]?.name || "Sur le Discord staff"}
                </p>
              ) : ready && lookup?.status === "ready" && !lookup.inGuild ? (
                <p className="mt-1 text-[10px] text-white/35">
                  Compte Discord trouvé
                </p>
              ) : null}
            </div>
          </div>
          {lookup?.roles.length ? (
            <div className="flex flex-wrap gap-1">
              {lookup.roles.slice(0, 6).map((role) => (
                <span
                  key={role.id}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/55"
                  style={
                    role.color
                      ? { borderColor: `${role.color}55`, color: role.color }
                      : undefined
                  }
                >
                  {role.name}
                </span>
              ))}
            </div>
          ) : null}
          <label className="block text-[10px] text-white/40">
            ID Discord
            <input
              value={slot.discordId}
              onChange={(e) => {
                const discordId = parseDiscordId(e.target.value);
                setSlot({
                  ...slot,
                  discordId,
                  userId: isDiscordSnowflake(discordId) ? discordId : "",
                  enabled: true,
                });
              }}
              placeholder="1369716605805789281"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 font-mono text-xs text-white outline-none"
            />
          </label>
          <label className="block text-[10px] text-white/40">
            ID unique joueur (CVE), optionnel
            <input
              value={slot.uniqueId}
              onChange={(e) => setSlot({ ...slot, uniqueId: e.target.value })}
              placeholder="ex. 12345"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-white/45">
            <input
              type="checkbox"
              checked={slot.permIg}
              onChange={(e) => setSlot({ ...slot, permIg: e.target.checked })}
            />
            Permissions IG
          </label>
        </>
      )}
    </div>
  );
}

function emptySlot(enabled: boolean): SlotState {
  return {
    userId: "",
    uniqueId: "",
    discordId: "",
    displayName: "",
    permIg: false,
    enabled,
  };
}

function memberFromSlot(
  role: GmCellRoleId,
  slot: SlotState
): GmCellMember | null {
  const discordId = slot.discordId.trim();
  if (!isDiscordSnowflake(discordId)) return null;
  return {
    userId: discordId,
    displayName:
      slot.displayName.trim() &&
      !isPlaceholderDisplayName(slot.displayName)
        ? slot.displayName.trim()
        : discordId,
    uniqueId: slot.uniqueId.trim(),
    discordId,
    cellRole: role,
    permIg: slot.permIg,
  };
}

export function GamemastersPanel() {
  const { account, grade } = useAccount();
  const canManage = canManageGameMasters(grade);
  const canEditSuivi = canAccessReferentHq(grade);
  const [cells, setCells] = useState<GmCell[]>([]);
  const [gms, setGms] = useState<RefgmAccount[]>([]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [groupName, setGroupName] = useState("");
  const [qgPosition, setQgPosition] = useState("");
  const [notes, setNotes] = useState("");
  const [trameLabel, setTrameLabel] = useState("");
  const [trameInfo, setTrameInfo] = useState("");
  const [trameStatus, setTrameStatus] = useState("");
  const [trameLink, setTrameLink] = useState("");
  const [lead, setLead] = useState<SlotState>(emptySlot(true));
  const [brasDroit, setBrasDroit] = useState<SlotState>(emptySlot(false));
  const [brasGauche, setBrasGauche] = useState<SlotState>(emptySlot(false));

  function refresh() {
    setCells(listGmCells());
  }

  useEffect(() => {
    refresh();
    void listAllAccounts().then((list) =>
      setGms(list.filter((a) => a.status === "APPROVED"))
    );
    const onUpdate = () => refresh();
    window.addEventListener("refgm:staff-updated", onUpdate);
    window.addEventListener("refgm:missions-updated", onUpdate);
    window.addEventListener("refgm:discord-missions-updated", onUpdate);
    window.addEventListener("refgm:group-rewards-updated", onUpdate);
    return () => {
      window.removeEventListener("refgm:staff-updated", onUpdate);
      window.removeEventListener("refgm:missions-updated", onUpdate);
      window.removeEventListener("refgm:discord-missions-updated", onUpdate);
      window.removeEventListener("refgm:group-rewards-updated", onUpdate);
    };
  }, []);

  const gmMap = useMemo(
    () => Object.fromEntries(gms.map((g) => [g.userId, g])),
    [gms]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cells;
    return cells.filter((c) => {
      const hay = [
        c.groupName,
        c.qgPosition,
        c.notes,
        c.trameLabel,
        c.trameInfo,
        ...c.members.map((m) => `${m.displayName} ${m.uniqueId}`),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [cells, query]);

  function resetForm() {
    setGroupName("");
    setQgPosition("");
    setNotes("");
    setTrameLabel("");
    setTrameInfo("");
    setTrameStatus("");
    setTrameLink("");
    setLead(emptySlot(true));
    setBrasDroit(emptySlot(false));
    setBrasGauche(emptySlot(false));
    setEditingId(null);
    setCreating(false);
    setError(null);
  }

  function openCreate() {
    resetForm();
    setCreating(true);
  }

  function openEdit(cell: GmCell) {
    setCreating(true);
    setEditingId(cell.id);
    setGroupName(cell.groupName);
    setQgPosition(cell.qgPosition);
    setNotes(cell.notes);
    setTrameLabel(cell.trameLabel ?? "");
    setTrameInfo(cell.trameInfo ?? "");
    setTrameStatus(cell.trameStatus ?? "");
    setTrameLink(cell.trameLink ?? "");
    const l = cell.members.find((m) => m.cellRole === "PRINCIPAL");
    const d = cell.members.find((m) => m.cellRole === "BRAS_DROIT");
    const g = cell.members.find((m) => m.cellRole === "BRAS_GAUCHE");
    setLead({
      enabled: true,
      userId: l?.userId ?? "",
      uniqueId: l?.uniqueId ?? "",
      discordId: l?.discordId || l?.userId || "",
      displayName: l?.displayName ?? "",
      permIg: Boolean(l?.permIg),
    });
    setBrasDroit({
      enabled: Boolean(d),
      userId: d?.userId ?? "",
      uniqueId: d?.uniqueId ?? "",
      discordId: d?.discordId || d?.userId || "",
      displayName: d?.displayName ?? "",
      permIg: Boolean(d?.permIg),
    });
    setBrasGauche({
      enabled: Boolean(g),
      userId: g?.userId ?? "",
      uniqueId: g?.uniqueId ?? "",
      discordId: g?.discordId || g?.userId || "",
      displayName: g?.displayName ?? "",
      permIg: Boolean(g?.permIg),
    });
    setError(null);
  }

  function buildMembers(): GmCellMember[] {
    const members: GmCellMember[] = [];
    const leadMember = memberFromSlot("PRINCIPAL", lead);
    if (leadMember) members.push(leadMember);
    if (brasDroit.enabled) {
      const m = memberFromSlot("BRAS_DROIT", brasDroit);
      if (m) members.push(m);
    }
    if (brasGauche.enabled) {
      const m = memberFromSlot("BRAS_GAUCHE", brasGauche);
      if (m) members.push(m);
    }
    return members;
  }

  function submit() {
    if (!canManage) return;
    setError(null);
    if (!groupName.trim()) {
      setError("Indique le nom du groupe GM.");
      return;
    }
    if (!isDiscordSnowflake(lead.discordId)) {
      setError("Colle l’ID Discord du Lead.");
      return;
    }
    try {
      saveGmCell(
        {
          id: editingId ?? undefined,
          groupName,
          qgPosition,
          notes,
          trameLabel,
          trameInfo,
          trameStatus,
          trameLink,
          members: buildMembers(),
        },
        { id: account.userId, name: account.displayName }
      );
      resetForm();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  const field = "rg-field mt-1";

  return (
    <StaffPageShell
      title="GameMasters"
      description="Recense chaque groupe GM : équipe, IDs, perms IG, QG et trame."
      className="max-w-6xl"
      actions={
        canManage ? (
          <MetallicButton
            type="button"
            onClick={openCreate}
            label="Nouveau groupe GM"
          />
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un groupe, QG, GM, trame…"
          className="rg-field min-w-[220px] flex-1"
        />
        <p className="text-xs text-white/35">
          {cells.length} cellule{cells.length > 1 ? "s" : ""} · {gms.length} GM
          approuvés
        </p>
      </div>

      {creating && canManage ? (
        <section className="rg-card space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-white/90">
              {editingId ? "Modifier le groupe" : "Créer un groupe GM"}
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-white/40 hover:text-white/70"
            >
              Annuler
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[11px] text-white/40">
              Nom du groupe
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className={field}
                placeholder="ex. Cellule Nord"
              />
            </label>
            <label className="text-[11px] text-white/40">
              Position du QG
              <input
                value={qgPosition}
                onChange={(e) => setQgPosition(e.target.value)}
                className={field}
                placeholder="ex. Mirror Park / coords"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[11px] text-white/40">
              Trame (titre)
              <input
                value={trameLabel}
                onChange={(e) => setTrameLabel(e.target.value)}
                className={field}
                placeholder="Nom de la trame"
              />
            </label>
            <label className="text-[11px] text-white/40">
              Avancement trame
              <input
                value={trameStatus}
                onChange={(e) => setTrameStatus(e.target.value)}
                className={field}
                placeholder="ex. Chapitre 2 / en pause"
              />
            </label>
          </div>
          <label className="block text-[11px] text-white/40">
            Lien trame (Gdoc, Notion…)
            <input
              value={trameLink}
              onChange={(e) => setTrameLink(e.target.value)}
              className={field}
              placeholder="https://docs.google.com/…"
            />
          </label>
          <label className="block text-[11px] text-white/40">
            Informations Trame (référents)
            <textarea
              value={trameInfo}
              onChange={(e) => setTrameInfo(e.target.value)}
              rows={2}
              className={cn(field, "resize-none")}
              placeholder="Résumé de la trame pour les référents…"
            />
          </label>
          <label className="block text-[11px] text-white/40">
            Notes d’intégration
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={cn(field, "resize-none")}
              placeholder="Contexte, parrain, points d’attention…"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <SlotFields
              label="Lead GM"
              slot={lead}
              setSlot={setLead}
              required
            />
            <SlotFields
              label="Bras droit GM"
              slot={brasDroit}
              setSlot={setBrasDroit}
            />
            <SlotFields
              label="Bras gauche GM"
              slot={brasGauche}
              setSlot={setBrasGauche}
            />
          </div>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <MetallicButton
            type="button"
            onClick={submit}
            label={editingId ? "Enregistrer" : "Créer le groupe"}
          />
        </section>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rg-empty text-sm text-[#8a8a93]">
          Aucun groupe GM. Crée le premier pour intégrer les nouveaux
          GameMasters.
        </p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((cell) => {
            const summary = summarizeGmCellActivity(cell, cells);
            const log = summary.log;
            return (
              <article key={cell.id} className="rg-card overflow-hidden">
                <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[15px] font-semibold text-white">
                      <Users className="h-3.5 w-3.5 text-white/40" />
                      {cell.groupName}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/40">
                      <MapPin className="h-3 w-3" />
                      {cell.qgPosition || "QG non renseigné"}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(cell)}
                        className="text-[11px] text-white/40 hover:text-white/80"
                      >
                        Éditer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteGmCell(cell.id, {
                            id: account.userId,
                            name: account.displayName,
                          });
                          refresh();
                        }}
                        className="text-white/30 hover:text-white/60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 p-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
                  <div className="min-w-0 space-y-2.5">
                    <p className="text-[10px] font-medium tracking-[0.16em] text-white/35 uppercase">
                      Équipe
                    </p>
                    <div className="space-y-1.5">
                      {cell.members.map((m) => (
                        <GmMemberCard
                          key={`${m.cellRole}-${m.discordId || m.userId}`}
                          member={m}
                          account={gmMap[m.userId] ?? gmMap[m.discordId]}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <StatChip label="Missions" value={summary.missionCount + summary.suiviCount} />
                      <StatChip
                        label="Or Rouge"
                        value={summary.orRouge}
                        icon={<OrIcon color="rouge" className="h-3 w-3" />}
                      />
                      <StatChip
                        label="Or Bleu"
                        value={summary.orBleu}
                        icon={<OrIcon color="bleu" className="h-3 w-3" />}
                      />
                    </div>
                    {cell.notes ? (
                      <p className="text-[11px] leading-snug text-white/40">{cell.notes}</p>
                    ) : null}
                  </div>

                  <div className="min-w-0 space-y-2">
                    <p className="text-[10px] font-medium tracking-[0.16em] text-white/35 uppercase">
                      Missions & suivi
                    </p>
                    {log.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs text-white/35">
                        Aucune mission enregistrée pour ce groupe.
                      </p>
                    ) : (
                      <ul className="max-h-56 divide-y divide-white/[0.05] overflow-auto rounded-xl border border-white/[0.06] bg-black/15">
                        {log.map((item) => (
                          <li
                            key={item.id}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[12px] leading-4 font-medium text-white/90">
                                {item.title}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] leading-3.5 text-white/38">
                                {item.detail || "·"}
                                {" · "}
                                {new Date(item.when).toLocaleDateString("fr-FR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {canEditSuivi && item.kind === "suivi" ? (
                                <SuiviManageActions
                                  compact
                                  rewardIds={[item.id.replace(/^r-/, "")]}
                                />
                              ) : null}
                              <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] leading-none font-medium text-white/50">
                                {item.kind === "suivi" ? "Suivi" : "Mission"}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </StaffPageShell>
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function StatChip({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
      <p className="text-[9px] leading-none text-white/40">{label}</p>
      <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] leading-none font-medium tabular-nums text-white">
        {icon}
        <span className="truncate">{formatCompact(value)}</span>
      </p>
    </div>
  );
}

function GmMemberCard({
  member,
  account,
}: {
  member: GmCellMember;
  account?: RefgmAccount;
}) {
  const discordId = member.discordId || member.userId;
  const lookup = useDiscordUser(
    isDiscordSnowflake(discordId) ? discordId : null
  );
  const name = discordDisplayName(lookup, member.displayName);
  const avatar = pickDiscordAvatar(
    lookup?.avatarUrl,
    account?.discordAvatarUrl
  );
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
      <DiscordAvatar
        name={name}
        url={avatar}
        userId={discordId}
        size={32}
        className="rounded-full"
      />
      <div className="min-w-0">
        <p className="truncate text-[12px] leading-4 font-medium text-white">
          {name}
        </p>
        <p className="mt-0.5 truncate text-[10px] leading-3.5 text-white/40">
          {GM_CELL_ROLE_LABEL[member.cellRole]}
          {lookup?.handle ? ` · @${lookup.handle}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(discordId).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          });
        }}
        className="shrink-0 self-center text-[10px] leading-none text-white/35 hover:text-white/70"
      >
        {copied ? "ok" : "ID"}
      </button>
    </div>
  );
}
