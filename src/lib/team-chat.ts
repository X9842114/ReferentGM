import { kvRead, kvWrite } from "@/lib/app-kv";
import { pushNotifications } from "@/lib/notifications";

export type ChatChannel = "GENERAL" | "MISSIONS" | "AIDE";
export type ChatMessage = { id: string; channel: ChatChannel; authorId: string; authorName: string; authorAvatar: string; body: string; mentionIds: string[]; createdAt: string };
const KEY = "refgm.team-chat.v1";

export function listChatMessages(): ChatMessage[] {
  const rows = kvRead<ChatMessage[]>(KEY, []);
  return Array.isArray(rows)
    ? rows.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    : [];
}

export function sendChatMessage(input: Omit<ChatMessage, "id" | "createdAt">) {
  const body = input.body.trim().slice(0, 2000); if (!body) return null;
  const row: ChatMessage = { ...input, body, id: crypto.randomUUID(), createdAt: new Date().toISOString(), mentionIds: [...new Set(input.mentionIds.filter((id) => id !== input.authorId))] };
  const rows = [...listChatMessages(), row].slice(-500);
  kvWrite(KEY, rows, "refgm:chat-updated");
  if (row.mentionIds.length) pushNotifications(row.mentionIds, { type: "CHAT_MENTION", title: `${row.authorName} t'a mentionné dans le chat`, body: body.slice(0, 180), href: `/dashboard/chat?channel=${row.channel}&message=${row.id}` });
  return row;
}
