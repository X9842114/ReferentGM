import { kvRead, kvWrite } from "@/lib/app-kv";

export type WorkshopPermission = "VIEW" | "COMMENT" | "EDIT";

export type WorkshopCollaborator = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  permission: WorkshopPermission;
  color: string;
};

export type WorkshopPoint = { x: number; y: number };

export type WorkshopBoardItem =
  | { id: string; type: "path"; color: string; width: number; points: WorkshopPoint[] }
  | { id: string; type: "rect"; color: string; width: number; x: number; y: number; w: number; h: number }
  | { id: string; type: "arrow"; color: string; width: number; x: number; y: number; endX: number; endY: number }
  | { id: string; type: "note"; color: string; x: number; y: number; w: number; h: number; text: string }
  | { id: string; type: "image"; src: string; x: number; y: number; w: number; h: number };

export type WorkshopInfoBlock = {
  id: string;
  title: string;
  body: string;
  color: string;
  x: number;
  y: number;
};

export type WorkshopConnection = {
  id: string;
  fromId: string;
  toId: string;
  color: string;
};

export type WorkshopSnapshot = Pick<SceneWorkshop, "title" | "summary" | "documentHtml" | "documentText" | "boardItems" | "mapItems" | "infoBlocks" | "connections" | "collaborators" | "status">;
export type WorkshopVersion = { id: string; createdAt: string; createdById: string; createdByName: string; label: string; snapshot: WorkshopSnapshot };

export type SceneWorkshop = {
  id: string;
  title: string;
  summary: string;
  documentHtml: string;
  documentText: string;
  boardItems: WorkshopBoardItem[];
  mapItems: WorkshopBoardItem[];
  infoBlocks: WorkshopInfoBlock[];
  connections: WorkshopConnection[];
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  collaborators: WorkshopCollaborator[];
  status: "DRAFT" | "READY" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  updatedById: string;
  updatedByName: string;
  versions: WorkshopVersion[];
  deletedAt: string | null;
  deletedById: string | null;
};

const KEY = "refgm.scene-workshops.v1";

function read(): SceneWorkshop[] {
  const parsed = kvRead<SceneWorkshop[]>(KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((row) => ({
    ...row,
    boardItems: Array.isArray(row.boardItems) ? row.boardItems : [],
    mapItems: Array.isArray(row.mapItems) ? row.mapItems : [],
    infoBlocks: Array.isArray(row.infoBlocks) ? row.infoBlocks : [],
    connections: Array.isArray(row.connections) ? row.connections : [],
    versions: Array.isArray(row.versions) ? row.versions : [],
    deletedAt: typeof row.deletedAt === "string" ? row.deletedAt : null,
    deletedById: typeof row.deletedById === "string" ? row.deletedById : null,
  }));
}

function write(rows: SceneWorkshop[]) {
  kvWrite(KEY, rows, "refgm:scene-workshops-updated");
}
function audit(action:string,entityId:string,metadata?:Record<string,unknown>){void fetch("/api/audit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,entityType:"scene_workshop",entityId,metadata})}).catch(()=>undefined);}

export function listSceneWorkshops(userId?: string): SceneWorkshop[] {
  return read()
    .filter((row) => !row.deletedAt && (!userId || row.ownerId === userId || row.collaborators.some((member) => member.userId === userId)))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function getSceneWorkshop(id: string): SceneWorkshop | null {
  return read().find((row) => row.id === id) ?? null;
}

export function createSceneWorkshop(input: { ownerId: string; ownerName: string; ownerAvatarUrl: string | null }): SceneWorkshop {
  const now = new Date().toISOString();
  const row: SceneWorkshop = {
    id: crypto.randomUUID(), title: "Nouvelle scène", summary: "", documentHtml: "", documentText: "", boardItems: [], infoBlocks: [], connections: [],
    ownerId: input.ownerId, ownerName: input.ownerName, ownerAvatarUrl: input.ownerAvatarUrl,
    mapItems: [], collaborators: [], status: "DRAFT", createdAt: now, updatedAt: now,
    updatedById: input.ownerId, updatedByName: input.ownerName,
    versions: [], deletedAt: null, deletedById: null,
  };
  write([row, ...read()]);
  audit("workshop.created",row.id,{title:row.title});
  return row;
}

export function saveSceneWorkshop(next: SceneWorkshop): SceneWorkshop {
  const rows = read();
  const index = rows.findIndex((row) => row.id === next.id);
  const now = new Date().toISOString();
  const previous = index >= 0 ? rows[index] : null;
  const lastVersionAt = previous?.versions?.at(-1)?.createdAt;
  const shouldVersion = Boolean(previous && (!lastVersionAt || Date.parse(now) - Date.parse(lastVersionAt) >= 120_000) && snapshotSignature(previous) !== snapshotSignature(next));
  const versions = shouldVersion && previous ? [...(previous.versions || []), { id: crypto.randomUUID(), createdAt: now, createdById: next.updatedById, createdByName: next.updatedByName, label: `Sauvegarde automatique · ${next.updatedByName}`, snapshot: snapshot(previous) }].slice(-10) : next.versions || [];
  const saved = { ...next, versions, updatedAt: now };
  if (index >= 0) rows[index] = saved; else rows.unshift(saved);
  write(rows);
  if(shouldVersion)audit("workshop.version_created",saved.id,{versionId:versions.at(-1)?.id,versionCount:versions.length});
  return saved;
}

export function deleteSceneWorkshop(id: string) {
  const now=new Date().toISOString();write(read().map((row)=>row.id===id?{...row,deletedAt:now,deletedById:row.updatedById}:row));
  audit("workshop.moved_to_trash",id);
}

export function listDeletedSceneWorkshops(userId:string){return read().filter((row)=>Boolean(row.deletedAt)&&row.ownerId===userId).sort((a,b)=>Date.parse(b.deletedAt||"")-Date.parse(a.deletedAt||""));}
export function restoreDeletedSceneWorkshop(id:string){write(read().map((row)=>row.id===id?{...row,deletedAt:null,deletedById:null,updatedAt:new Date().toISOString()}:row));audit("workshop.restored_from_trash",id);}
export function permanentlyDeleteSceneWorkshop(id:string){write(read().filter((row)=>row.id!==id));audit("workshop.permanently_deleted",id);}
export function restoreSceneWorkshopVersion(id:string,versionId:string,actor:{id:string;name:string}){const rows=read();const index=rows.findIndex((row)=>row.id===id);if(index<0)return null;const current=rows[index];const version=current.versions.find((item)=>item.id===versionId);if(!version)return null;const now=new Date().toISOString();const before:{ id:string;createdAt:string;createdById:string;createdByName:string;label:string;snapshot:WorkshopSnapshot }={id:crypto.randomUUID(),createdAt:now,createdById:actor.id,createdByName:actor.name,label:`Avant restauration · ${actor.name}`,snapshot:snapshot(current)};const restored={...current,...version.snapshot,versions:[...current.versions,before].slice(-10),updatedAt:now,updatedById:actor.id,updatedByName:actor.name};rows[index]=restored;write(rows);audit("workshop.version_restored",id,{versionId});return restored;}
export function compareWorkshopVersion(current:SceneWorkshop,version:WorkshopVersion){return {titleChanged:current.title!==version.snapshot.title,summaryChanged:current.summary!==version.snapshot.summary,textDelta:current.documentText.length-version.snapshot.documentText.length,boardDelta:current.boardItems.length-version.snapshot.boardItems.length,mapDelta:current.mapItems.length-version.snapshot.mapItems.length,blocksDelta:current.infoBlocks.length-version.snapshot.infoBlocks.length};}

function snapshot(row:SceneWorkshop):WorkshopSnapshot{return {title:row.title,summary:row.summary,documentHtml:row.documentHtml,documentText:row.documentText,boardItems:row.boardItems,mapItems:row.mapItems,infoBlocks:row.infoBlocks,connections:row.connections,collaborators:row.collaborators,status:row.status};}
function snapshotSignature(row:SceneWorkshop){return JSON.stringify([row.title,row.summary,row.documentText,row.boardItems.length,row.mapItems.length,row.infoBlocks,row.connections,row.collaborators,row.status]);}

export function duplicateSceneWorkshop(source: SceneWorkshop, actor: { id: string; name: string; avatarUrl: string | null }): SceneWorkshop {
  const now = new Date().toISOString();
  const copy: SceneWorkshop = { ...source, id: crypto.randomUUID(), title: `${source.title} · copie`, ownerId: actor.id, ownerName: actor.name, ownerAvatarUrl: actor.avatarUrl, collaborators: [], versions: [], deletedAt: null, deletedById: null, status: "DRAFT", createdAt: now, updatedAt: now, updatedById: actor.id, updatedByName: actor.name };
  write([copy, ...read()]);
  audit("workshop.duplicated",copy.id,{sourceId:source.id});
  return copy;
}
