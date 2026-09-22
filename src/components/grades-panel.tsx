"use client";

import { useAccount } from "@/components/account-context";
import { DiscordAvatar } from "@/components/actor-trace";
import {
  listAllAccounts,
  setAccountGrade,
  type RefgmAccount,
} from "@/lib/accounts";
import {
  PERMISSION_FLAGS,
  permissionGroups,
  type PermissionFlagKey,
} from "@/lib/grade-registry";
import {
  createGrade,
  deleteGrade,
  emptyPermissions,
  toEditableGrade,
  updateGrade,
  type EditableGrade,
} from "@/lib/grade-storage";
import {
  assignableGradesFor,
  canAssignAllGrades,
  canManageGrades,
  getGradeLabel,
  isDeveloper,
  type GradeId,
} from "@/lib/permissions";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { MetallicButton } from "@/components/ui/metallic-button";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Lock,
  Pencil,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_EDIT: EditableGrade = {
  id: "",
  label: "",
  rank: 10,
  color: "#38bdf8",
  kind: "REFERENT",
  permissions: emptyPermissions(),
};

function slugFromLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export function GradesPanel() {
  const {
    account: self,
    grade: actorGrade,
    gradeDefs,
    refreshGradeDefs,
  } = useAccount();
  const [accounts, setAccounts] = useState<RefgmAccount[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [isNewRole, setIsNewRole] = useState(true);
  const [editing, setEditing] = useState<EditableGrade>(DEFAULT_EDIT);
  const [savingRole, setSavingRole] = useState(false);
  const [permQuery, setPermQuery] = useState("");

  const canManage = canManageGrades(actorGrade);
  const canAssignAll = canAssignAllGrades(actorGrade);
  const assignable = assignableGradesFor(actorGrade);
  const selectedCount = useMemo(() => {
    if (editing.permissions.fullAccess) return PERMISSION_FLAGS.length;
    return PERMISSION_FLAGS.filter(({ key }) => editing.permissions[key]).length;
  }, [editing.permissions]);
  const accessGroups = useMemo(() => {
    const needle = permQuery.trim().toLowerCase();
    return permissionGroups()
      .map((group) => ({
        ...group,
        flags: group.flags.filter(
          (flag) =>
            !needle ||
            flag.label.toLowerCase().includes(needle) ||
            flag.key.toLowerCase().includes(needle)
        ),
      }))
      .filter((group) => group.flags.length > 0);
  }, [permQuery]);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      void listAllAccounts().then((list) => {
        if (cancelled) return;
        setAccounts(list.filter((a) => a.status === "APPROVED" && !isDeveloper(a.grade)));
        setLoading(false);
      });
    };

    const onUpdate = () => load();
    load();
    window.addEventListener("refgm:accounts-updated", onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("refgm:accounts-updated", onUpdate);
    };
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return accounts.filter((a) => {
      const matchQ =
        !query ||
        a.displayName.toLowerCase().includes(query) ||
        a.userId.includes(query);
      const matchG = filter === "ALL" || a.grade === filter;
      return matchQ && matchG;
    });
  }, [accounts, q, filter]);

  const visibleDefs = useMemo(
    () => gradeDefs.filter((g) => g.id !== "DEVELOPPEUR" && g.kind !== "DEV"),
    [gradeDefs]
  );

  function openCreate() {
    setIsNewRole(true);
    setPermQuery("");
    setEditing({
      ...DEFAULT_EDIT,
      permissions: emptyPermissions(),
      rank: Math.max(...gradeDefs.map((g) => g.rank), 6) + 1,
    });
    setEditorOpen(true);
    setMessage(null);
  }

  function openEdit(id: string) {
    const grade = gradeDefs.find((item) => item.id === id);
    if (!grade || grade.id === "DEVELOPPEUR" || grade.kind === "DEV") return;
    setIsNewRole(false);
    setPermQuery("");
    setEditing(toEditableGrade(grade));
    setEditorOpen(true);
    setMessage(null);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditing(DEFAULT_EDIT);
  }

  const editingSystem = Boolean(
    !isNewRole && gradeDefs.find((item) => item.id === editing.id)?.isSystem
  );

  function togglePermission(key: PermissionFlagKey) {
    if (key === "fullAccess") {
      const next = !editing.permissions.fullAccess;
      if (next) {
        setAllPermissions(true);
        return;
      }
    }
    setEditing((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [key]: !current.permissions[key],
      },
    }));
  }

  function setAllPermissions(value: boolean) {
    setEditing((current) => ({
      ...current,
      permissions: Object.fromEntries(
        PERMISSION_FLAGS.map(({ key }) => [key, value])
      ) as Record<PermissionFlagKey, boolean>,
    }));
  }

  async function changeGrade(target: RefgmAccount, next: GradeId) {
    if (next === target.grade) return;
    setBusyId(target.userId);
    setMessage(null);
    const { result } = await setAccountGrade({
      actorUserId: self.userId,
      targetUserId: target.userId,
      grade: next,
    });
    if (!result.ok) {
      setMessage(result.reason);
    } else {
      setMessage(`Grade mis à jour : ${getGradeLabel(next)}`);
      const list = await listAllAccounts();
      setAccounts(list.filter((a) => a.status === "APPROVED" && !isDeveloper(a.grade)));
    }
    setBusyId(null);
  }

  async function saveRole() {
    const id = (editing.id || slugFromLabel(editing.label)).toUpperCase();
    if (!id || !editing.label.trim()) {
      setMessage("Nom et identifiant requis.");
      return;
    }
    if (id === "DEVELOPPEUR" || editing.kind === "DEV") {
      setMessage("Le rôle Développeur ne se modifie pas.");
      return;
    }
    setSavingRole(true);
    const payload = { ...editing, id };
    const action = isNewRole ? createGrade : updateGrade;
    const result = await action(payload);
    setMessage(result.error ?? `Grade « ${editing.label} » enregistré.`);
    if (!result.error) {
      await refreshGradeDefs();
      closeEditor();
    }
    setSavingRole(false);
  }

  async function removeRole(id: string) {
    if (!window.confirm("Supprimer ce rôle personnalisé ?")) return;
    const result = await deleteGrade(id);
    setMessage(result.error ?? "Rôle supprimé.");
    if (!result.error) {
      await refreshGradeDefs();
      if (editing.id === id) closeEditor();
    }
  }

  if (!canManage) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-sm text-white/45">
        Tu n’as pas la permission de gérer les grades.
      </div>
    );
  }

  return (
    <StaffPageShell
      title="Grades"
      description="Rôles du QG : accès, couleur, puis attribution aux comptes. Le Développeur reste hors de portée."
      backHref="/dashboard/administration"
      backLabel="Administration"
      className="max-w-5xl"
      actions={
        <MetallicButton
          type="button"
          onClick={openCreate}
          label="Nouveau rôle"
        />
      }
    >
        <AnimatePresence>
          {editorOpen ? (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rg-card p-4 sm:p-5"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-medium text-white/95">
                    {isNewRole ? "Créer un grade" : "Modifier le grade"}
                  </h2>
                  <p className="mt-1 text-xs text-white/45">
                    Sélectionne n’importe quel accès, ou tout d’un coup. Le Développeur n’est pas modifiable.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-lg border border-white/10 bg-black/30 p-2 text-white/55 hover:bg-white/[0.06] hover:text-white"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-white/50">
                  Nom affiché
                  <input
                    value={editing.label}
                    onChange={(event) => {
                      const label = event.target.value;
                      setEditing((current) => ({
                        ...current,
                        label,
                        id: isNewRole ? slugFromLabel(label) : current.id,
                      }));
                    }}
                    placeholder="Responsable événement"
                    className="rg-field mt-1.5"
                  />
                </label>
                <label className="text-xs text-white/50">
                  Identifiant
                  <input
                    value={editing.id}
                    disabled={!isNewRole}
                    onChange={(event) =>
                      setEditing((current) => ({
                        ...current,
                        id: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
                      }))
                    }
                    placeholder="RESPONSABLE_EVENT"
                    className="rg-field mt-1.5 font-mono disabled:opacity-50"
                  />
                </label>
                <label className="text-xs text-white/50">
                  Rang (0 = le plus haut)
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={editing.rank}
                    onChange={(event) =>
                      setEditing((current) => ({
                        ...current,
                        rank: Number(event.target.value),
                      }))
                    }
                    className="rg-field mt-1.5"
                  />
                </label>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <label className="text-xs text-white/50">
                    Type
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(
                        [
                          ["REFERENT", "Référent"],
                          ["GAMEMASTER", "GameMaster"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            if (editingSystem) return;
                            setEditing((current) => ({ ...current, kind: value }));
                          }}
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                            editing.kind === value
                              ? "border-violet-400/40 bg-violet-500/20 text-violet-100"
                              : "border-white/10 bg-black/30 text-white/50 hover:border-white/20 hover:text-white/80"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </label>
                  <label className="text-xs text-white/50">
                    Couleur
                    <input
                      type="color"
                      value={editing.color}
                      onChange={(event) =>
                        setEditing((current) => ({
                          ...current,
                          color: event.target.value,
                        }))
                      }
                      className="mt-1.5 block h-10 w-12 rounded-xl border border-white/10 bg-black/40 p-1"
                    />
                  </label>
                </div>
      </div>

              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium text-white/90">
                      Accès du rôle
                    </h3>
                    <p className="text-xs text-white/40">
                      {selectedCount} / {PERMISSION_FLAGS.length} permission
                      {selectedCount > 1 ? "s" : ""} cochée
                      {selectedCount > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                      <input
                        value={permQuery}
                        onChange={(event) => setPermQuery(event.target.value)}
                        placeholder="Filtrer un accès…"
                        className="rg-field h-8 w-44 pl-8 text-[11px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setAllPermissions(true)}
                      className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-white/60 hover:bg-white/[0.06]"
                    >
                      Tout activer
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllPermissions(false)}
                      className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-white/60 hover:bg-white/[0.06]"
                    >
                      Tout désactiver
                    </button>
                  </div>
                </div>

                {accessGroups.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <p className="text-[11px] tracking-wide text-white/35 uppercase">
                      {group.title}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.flags.map((meta) => {
                        const key = meta.key;
                        const active =
                          editing.permissions.fullAccess ||
                          editing.permissions[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => togglePermission(key)}
                            aria-pressed={active}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition-all",
                              active
                                ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-100 shadow-[0_0_18px_-10px_rgba(52,211,153,0.8)]"
                                : "border-white/10 bg-black/25 text-white/45 hover:border-white/20 hover:text-white/75"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded-full border",
                                active
                                  ? "border-emerald-300/50 bg-emerald-400/20"
                                  : "border-white/20"
                              )}
                            >
                              {active ? <Check className="h-2.5 w-2.5" /> : null}
                            </span>
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                {!isNewRole && !editingSystem ? (
                  <button
                    type="button"
                    onClick={() => void removeRole(editing.id)}
                    className="rg-btn rg-btn-danger mr-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rg-btn"
                >
                  Annuler
                </button>
                <MetallicButton
                  type="button"
                  disabled={savingRole || !editing.label.trim() || !(editing.id || slugFromLabel(editing.label))}
                  onClick={() => void saveRole()}
                  label={isNewRole ? "Créer le grade" : "Enregistrer"}
                />
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleDefs.map((g) => (
            <div key={g.id} className="rg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: g.color }}
                    />
                    <p className="truncate text-sm font-medium text-white">
                      {g.label}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] text-white/40">
                    {g.kind === "GAMEMASTER" ? "GameMaster" : "Référent"}
                    {g.isSystem ? " · système" : " · perso"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(g.id)}
                  className="rg-btn px-2.5 py-1.5 text-[11px]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Modifier
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un pseudo ou un ID"
              className="rg-field rg-field-icon py-2.5"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rg-field sm:w-56"
          >
            <option value="ALL">Tous les grades</option>
            {visibleDefs.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        {message ? (
          <p className="rg-inset px-3 py-2 text-xs text-white/60">
            {message}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-white/35">Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center rg-card px-6 py-16 text-center">
            <Users className="mb-4 h-8 w-8 text-white/30" />
            <p className="text-sm text-white/60">Aucun compte trouvé</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {filtered.map((user, index) => {
                const locked =
                  user.grade === "SUPERVISEUR_GM" && !canAssignAll;
                const options = Array.from(
                  new Set([user.grade, ...assignable])
                ).filter((id) => !isDeveloper(id));
                const currentColor =
                  gradeDefs.find((g) => g.id === user.grade)?.color ?? "#94a3b8";

                return (
                  <motion.div
                    key={user.userId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="rg-card p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <DiscordAvatar
                        name={user.displayName}
                        url={user.discordAvatarUrl}
                        userId={user.userId}
                        size={48}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white/90">
                          {user.displayName}
                          {user.userId === self.userId ? (
                            <span className="ml-2 text-[10px] text-white/35">
                              (toi)
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate font-mono text-[11px] text-white/35">
                          {user.userId}
                        </p>
                        <p
                          className="mt-1 inline-flex items-center gap-1.5 text-[11px]"
                          style={{ color: currentColor }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: currentColor }}
                          />
                          {getGradeLabel(user.grade)}
                        </p>
                      </div>
                      {locked ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/45">
                          <Lock className="h-3.5 w-3.5" />
                          Protégé
                        </span>
                      ) : null}
                    </div>

                    {!locked ? (
                      <div className="mt-3 flex w-full flex-wrap gap-1.5">
                        {options.map((id) => {
                          const meta = gradeDefs.find((g) => g.id === id);
                          const active = user.grade === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              disabled={busyId === user.userId}
                              onClick={() => void changeGrade(user, id)}
                        className={cn(
                                "max-w-full rounded-lg border px-2.5 py-1.5 text-left text-[11px] break-words transition-colors disabled:opacity-50",
                                active
                                  ? "border-white/25 bg-white/10 text-white"
                                  : "border-white/10 bg-black/30 text-white/50 hover:border-white/20 hover:text-white/80"
                              )}
                              style={
                                active
                                  ? {
                                      borderColor: `${meta?.color ?? "#fff"}55`,
                                      backgroundColor: `${meta?.color ?? "#fff"}22`,
                                      color: meta?.color,
                                    }
                                  : undefined
                              }
                            >
                            {getGradeLabel(id)}
                            </button>
                          );
                        })}
                    </div>
                    ) : null}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
    </StaffPageShell>
  );
}
