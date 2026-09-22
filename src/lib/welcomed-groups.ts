/** Groupes RP « nouveaux » / bienvenue sur le serveur */

import { kvRead, kvWrite } from "@/lib/app-kv";

export type WelcomedGroup = {
  id: string;
  name: string;
  kind: "PF" | "GANG" | "ORGA";
  note: string;
  welcomedBy: string;
  createdAt: string;
};

const KEY = "refgm.staff.welcomed-groups.v1";

function read(): WelcomedGroup[] {
  return kvRead<WelcomedGroup[]>(KEY, []);
}

function write(rows: WelcomedGroup[]) {
  kvWrite(KEY, rows, "refgm:staff-updated");
}

export function listWelcomedGroups(): WelcomedGroup[] {
  return read().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function addWelcomedGroup(input: {
  name: string;
  kind: "PF" | "GANG" | "ORGA";
  note?: string;
  welcomedBy: string;
}): WelcomedGroup {
  const row: WelcomedGroup = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    kind: input.kind,
    note: (input.note ?? "").trim(),
    welcomedBy: input.welcomedBy,
    createdAt: new Date().toISOString(),
  };
  write([row, ...read()]);
  return row;
}

export function deleteWelcomedGroup(id: string) {
  write(read().filter((g) => g.id !== id));
}
