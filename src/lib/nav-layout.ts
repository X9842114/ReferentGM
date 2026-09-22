import { kvRead, kvWrite } from "@/lib/app-kv";

export type NavCustomGroup = {
  id: string;
  label: string;
};

export type NavLayout = {
  collapsed: Record<string, boolean>;
  groupOrder: string[];
  itemOrder: Record<string, string[]>;
  itemGroup: Record<string, string>;
  customGroups: NavCustomGroup[];
  hidden: string[];
  groupLabels: Record<string, string>;
};

const KEY = "refgm.nav-layout.v1";

export function emptyNavLayout(): NavLayout {
  return {
    collapsed: {},
    groupOrder: [],
    itemOrder: {},
    itemGroup: {},
    customGroups: [],
    hidden: [],
    groupLabels: {},
  };
}

export function getNavLayout(userId: string): NavLayout {
  const id = userId.trim();
  if (!id) return emptyNavLayout();
  const all = kvRead<Record<string, NavLayout>>(KEY, {});
  const stored = all[id];
  if (!stored) return emptyNavLayout();
  return {
    ...emptyNavLayout(),
    collapsed: stored.collapsed ?? {},
    groupOrder: stored.groupOrder ?? [],
    itemOrder: stored.itemOrder ?? {},
    itemGroup: stored.itemGroup ?? {},
    customGroups: stored.customGroups ?? [],
    hidden: stored.hidden ?? [],
    groupLabels: stored.groupLabels ?? {},
  };
}

export function saveNavLayout(userId: string, layout: NavLayout) {
  const id = userId.trim();
  if (!id) return layout;
  const all = kvRead<Record<string, NavLayout>>(KEY, {});
  all[id] = layout;
  kvWrite(KEY, all, "refgm:prefs-updated");
  return layout;
}

export function orderByIds<T>(
  items: T[],
  order: string[],
  idOf: (item: T) => string
): T[] {
  if (order.length === 0) return items;
  const map = new Map(items.map((item) => [idOf(item), item] as const));
  const next: T[] = [];
  for (const id of order) {
    const item = map.get(id);
    if (!item) continue;
    next.push(item);
    map.delete(id);
  }
  for (const item of items) {
    if (map.has(idOf(item))) next.push(item);
  }
  return next;
}

export function swapIndex(ids: string[], index: number, dir: -1 | 1) {
  const nextIndex = index + dir;
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return ids;
  const next = [...ids];
  const current = next[index];
  const neighbor = next[nextIndex];
  if (!current || !neighbor) return ids;
  next[index] = neighbor;
  next[nextIndex] = current;
  return next;
}
